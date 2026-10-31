import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Read-only checks against the real release app, not the in-memory UI transport.
const endpoint = process.argv[2] ?? 'http://127.0.0.1:9223';
const fixture = process.argv[3];
assert.equal(new URL(endpoint).hostname, '127.0.0.1');
const deadline = Date.now() + 30_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) { ready = true; break; }
  } catch { /* WebView2 is still starting. */ }
  await new Promise(resolve => setTimeout(resolve, 400));
}
assert.ok(ready, 'O WebView2 não disponibilizou o canal local de teste');
const browser = await chromium.connectOverCDP(endpoint);
try {
  const pages = browser.contexts().flatMap(context => context.pages());
  assert.equal(pages.length, 1, 'Era esperada uma janela WebView2 do aplicativo em teste');
  const page = pages[0];
  page.on('response', response => { if (response.url().includes('asset.localhost') && !response.ok()) console.error(`Asset HTTP ${response.status()}: ${response.url()}`); });
  await page.waitForFunction(() => window.isTauri === true);
  await page.getByRole('button',{name:'Meus mangás',exact:true}).click();await page.getByRole('heading', { name: /Sua biblioteca/ }).waitFor();
  assert.ok(page.url().includes('tauri.localhost'), `URL inesperada no aplicativo: ${page.url()}`);
  const native = await page.evaluate(async () => {
    const [books, settings, queue] = await Promise.all([
      window.__TAURI_INTERNALS__.invoke('list_books'),
      window.__TAURI_INTERNALS__.invoke('get_settings'),
      window.__TAURI_INTERNALS__.invoke('get_saved_queue'),
    ]);
    return { bookCount: books.length, settingsObject: !!settings && typeof settings === 'object', queueValid: Number.isSafeInteger(queue.revision) && (queue.queue === null || Array.isArray(queue.queue.items)), preview: document.body.innerText.includes('Prévia da interface.') };
  });
  assert.ok(Number.isInteger(native.bookCount));
  assert.equal(native.settingsObject, true);
  assert.equal(native.queueValid, true);
  assert.equal(native.preview, false);
  assert.equal(await page.getByRole('alert').count(), 0);
  console.log('PASS: release app loads its bundled interface and calls real Rust/SQLite commands');
  if (process.env.YOMI_SMOKE_QUEUE_STORE === '1') {
    const original=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_saved_queue'));
    if(original.queue!==null) console.log('SKIP: queue persistence write test preserves an existing saved queue');
    else {
      let saved;
      try {
        saved=await page.evaluate(expectedRevision=>window.__TAURI_INTERNALS__.invoke('save_download_queue',{expectedRevision,queue:{server:'http://127.0.0.1:9/',mangaId:42,title:'Teste temporário de persistência',items:[{id:8,name:'Capítulo de teste',status:'downloading',error:null}]}}),original.revision);
        const loaded=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_saved_queue'));
        assert.deepEqual(loaded,saved);
        const stale=await page.evaluate(async expectedRevision=>{try{await window.__TAURI_INTERNALS__.invoke('save_download_queue',{expectedRevision,queue:null});return false;}catch{return true;}},original.revision);
        assert.equal(stale,true);
        console.log('PASS: real queue IPC persists and reloads its snapshot, and rejects stale changes');
      } finally {
        if(saved)await page.evaluate(expectedRevision=>window.__TAURI_INTERNALS__.invoke('save_download_queue',{expectedRevision,queue:null}),saved.revision);
      }
    }
  }
  if (process.env.YOMI_SMOKE_DOWNLOADS === '1') {
    const { testNativeDownload } = await import('./native-download.mjs');
    await testNativeDownload(page);
  }
  const fixtures = fixture ? [fixture] : [];
  if (process.env.YOMI_SMOKE_SUWAYOMI_URL && process.env.YOMI_SMOKE_READ_ONLY === '1') {
    fixtures.push(await page.evaluate(async server => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const results = await invoke('suwayomi_search', { server, source: '0', query: 'Yomi Test', page: 1 });
      const manga = results.mangas.find(manga => manga.title === 'Yomi Test');
      return invoke('suwayomi_cover', { server, mangaId: manga.id });
    }, process.env.YOMI_SMOKE_SUWAYOMI_URL));
  }
  for (const fixture of fixtures) {
    const dimensions = await page.evaluate(path => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Falha no protocolo asset da versão Windows'));
      image.src = window.__TAURI_INTERNALS__.convertFileSrc(path, 'asset');
    }), fixture);
    assert.ok(dimensions.width > 0 && dimensions.height > 0);
    console.log('PASS: native asset protocol loads an existing PNG inside the app library');
  }
  if (process.env.YOMI_SMOKE_SUWAYOMI_URL && process.env.YOMI_SMOKE_READ_ONLY === '1') {
    const server = process.env.YOMI_SMOKE_SUWAYOMI_URL;
    assert.equal(new URL(server).hostname, '127.0.0.1');
    const data = await page.evaluate(async server => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const connection = await invoke('suwayomi_connect', { server });
      const results = await invoke('suwayomi_search', { server, source: '0', query: 'Yomi Test', page: 1 });
      const manga = results.mangas.find(manga => manga.title === 'Yomi Test');
      if (!manga) throw new Error('Fixture local não encontrada');
      const chapters = await invoke('suwayomi_chapters', { server, mangaId: manga.id });
      return { connection, chapterCount: chapters.chapters.length };
    }, server);
    assert.ok(data.connection.sources.some(source => source.id === '0'));
    assert.ok(data.chapterCount > 0);
    console.log('PASS: real release IPC connects to Suwayomi, searches its local source and fetches chapters without changing Yomi books/settings');
  }
  if (process.env.YOMI_SMOKE_SUWAYOMI_URL && process.env.YOMI_SMOKE_READ_ONLY !== '1') {
    const server = process.env.YOMI_SMOKE_SUWAYOMI_URL;
    assert.equal(new URL(server).hostname, '127.0.0.1');
    const original = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('get_settings'));
    const before = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('list_books'));
    assert.ok(!before.some(book => book.source.startsWith(`suwayomi:${server.replace(/\/$/, '')}/#`)), 'A instância de teste já tem capítulos; teste interrompido para preservar dados');
    try {
      await page.getByRole('button', { name: 'Fontes online', exact: true }).click();
      await page.getByLabel('Endereço do servidor', { exact: true }).fill(server);
      await page.getByRole('button', { name: 'Conectar', exact: true }).click();
      await page.getByLabel('Fonte', { exact: true }).selectOption('0');
      await page.getByLabel('Nome do mangá', { exact: true }).fill('Yomi Test');
      await page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await page.getByRole('button', { name:/Ver capítulos de Yomi Test/ }).click();
      await page.getByRole('button', { name: 'Baixar e ler', exact: true }).first().click();
      await page.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).waitFor();
      await page.getByLabel('Modo de leitura', { exact: true }).selectOption('single');
      await page.waitForFunction(() => [...document.querySelectorAll('.reader img')].some(image => image.naturalWidth > 0));
      await page.getByLabel('Próxima página', { exact: true }).click();
      await page.getByLabel('Voltar à biblioteca', { exact: true }).click();
      const books = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('list_books'));
      const book = books.find(book => book.source.startsWith(`suwayomi:${server.replace(/\/$/, '')}/#`));
      assert.ok(book); assert.equal(book.pageCount, 2); assert.equal(book.page, 1); assert.equal(book.completed, true);
      const cached = await page.evaluate(book => window.__TAURI_INTERNALS__.invoke('open_book', { id: book.id }), book);
      assert.equal(cached.pages.length, 2); assert.equal(cached.book.page, 1);
      console.log('PASS: real Suwayomi sources/search/chapters/download, decoded chapter image and persistent reading progress through native UI/IPC');
    } finally {
      await page.evaluate(async ({ server, before, original }) => {
        const books = await window.__TAURI_INTERNALS__.invoke('list_books');
        for (const book of books) if (!before.some(old => old.id === book.id) && book.source.startsWith(`suwayomi:${server.replace(/\/$/, '')}/#`)) await window.__TAURI_INTERNALS__.invoke('remove_book', { id: book.id });
        await window.__TAURI_INTERNALS__.invoke('save_settings', { value: original });
      }, { server, before, original });
    }
  }
} finally { await browser.close(); }
