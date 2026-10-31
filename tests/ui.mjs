import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Tests the UI with an in-memory Tauri transport. This does NOT test Rust/SQLite.
const browser = await chromium.launch({ headless: true, ...(process.env.YOMI_BROWSER_CHANNEL ? { channel: process.env.YOMI_BROWSER_CHANNEL } : {}) });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('pageerror', e => errors.push(e.message));
const base = process.env.YOMI_TEST_URL ?? 'http://127.0.0.1:1420';
try {
  await page.goto(base);
  await page.getByRole('button',{name:'Meus mangás',exact:true}).click();
  await page.getByText('Sua primeira história começa aqui').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Importar mangá', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Exportar dados de leitura', exact: true }).isDisabled(), true);
  await page.getByLabel('Tema', { exact: true }).selectOption('sepia');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'sepia');
  await page.reload();
  await page.getByRole('button',{name:'Meus mangás',exact:true}).click();
  await page.getByText('Sua primeira história começa aqui').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'sepia');
  console.log('PASS: browser preview, import disabled, settings persistence');

  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const native = await context.newPage();
  native.on('pageerror', e => errors.push(e.message));
  await native.addInitScript(() => {
    const books = [];
    const bookmarks = new Set();
    const callbacks = new Map();
    const listeners = new Map();
    let nextCallback = 1;
    let nextListener = 1;
    let savedBackup = null;
    let restoreToken = 0;
    let settings = { mode: 'single', direction: 'rtl', guardian: false };
    window.isTauri = true;
    window.__testSaves = [];
    window.__failProgress = false;
    window.__destroyed = false;
    window.__backupMode = 'valid';
    window.__failRestore = false;
    window.__failMetadata = false;
    window.__legacyBackup = false;
    window.__metadataWrites = [];
    window.__testBooks = books;
    window.__batchMode = 'mixed';
    window.__finishBatch = null;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_event, id) => listeners.delete(id) };
    window.__requestClose = async () => {
      for (const [id, listener] of listeners) {
        if (listener.event === 'tauri://close-requested') await callbacks.get(listener.handler)({ event: listener.event, id, payload: null });
      }
    };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: callback => { const id = nextCallback++; callbacks.set(id, callback); return id; },
      convertFileSrc: () => '/__test-page.ico',
      invoke: async (cmd, args) => {
        if(cmd==='start_integrated_engine'||cmd==='suwayomi_connect')return {server:'http://127.0.0.1:4567/',name:'Fixture',version:'1',sources:[]};
        if(cmd==='get_saved_queue')return {revision:0,queue:null};
        if(cmd==='reader_fullscreen'){if(args.enabled!==null)window.__readerFull=args.enabled;return window.__readerFull??false;}
        if (cmd === 'plugin:event|listen') { const id = nextListener++; listeners.set(id, args); return id; }
        if (cmd === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
        if (cmd === 'plugin:window|destroy') { window.__destroyed = true; return; }
        if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if (cmd === 'list_site_readings') return []; if(cmd==='set_site_layout')return;
        if (cmd === 'list_books') return structuredClone(books);
        if (cmd === 'get_settings') return settings;
        if (cmd === 'save_settings') { settings = args.value; return; }
        if (cmd === 'export_reading_backup') {
          savedBackup = { books: structuredClone(books), bookmarks: [...bookmarks], settings: structuredClone(settings) };
          return 'C:/teste/yomi-leitura.json';
        }
        if (cmd === 'preview_reading_restore') {
          if (window.__backupMode === 'cancel') return null;
          if (window.__backupMode === 'invalid') throw new Error('O arquivo não é um backup de leitura Yomi válido');
          return { token: `restore-${++restoreToken}`, createdAt: 1792960749, matched: 1, skipped: 1, settingsIncluded: true, organizationIncluded: !window.__legacyBackup, rows: [{ title: 'Volume de teste', matched: true, reason: 'Volume identificado' }, { title: 'Volume ausente', matched: false, reason: 'Volume não encontrado' }] };
        }
        if (cmd === 'cancel_reading_restore') return;
        if (cmd === 'apply_reading_restore') {
          if (window.__failRestore) throw new Error('Falha simulada: não foi possível criar a cópia anterior');
          if (!savedBackup) throw new Error('Nenhum backup simulado');
          const current = new Map(books.map(book => [book.id, book]));
          books.splice(0, books.length, ...structuredClone(savedBackup.books).map(book => window.__legacyBackup ? { ...book, title: current.get(book.id).title, series: current.get(book.id).series, chapter: current.get(book.id).chapter } : book));
          bookmarks.clear(); for (const page of savedBackup.bookmarks) bookmarks.add(page);
          if (args.includeSettings) settings = structuredClone(savedBackup.settings);
          return { restored: 1, skipped: 1, settingsRestored: args.includeSettings, organizationRestored: !window.__legacyBackup, recoveryPath: 'C:/teste/backups/antes-de-restaurar.json' };
        }
        if (cmd === 'import_book') {
          const book = { id: 'test-volume', title: 'Volume de teste', series: '', chapter: '', source: 'test', format: 'cbz', cover: 'cover', pageCount: 5, page: 0, completed: false, favorite: false, addedAt: 1, lastRead: null };
          if (!books.length) books.push(book);
          return book;
        }
        if (cmd === 'import_cbz_batch') {
          if (window.__batchMode === 'cancel') return null;
          if (window.__batchMode === 'oversized') throw new Error('Selecione no máximo 50 arquivos CBZ por lote');
          if (window.__batchMode === 'held') await new Promise(resolve => { window.__finishBatch = resolve; });
          const failed = { name:'3.cbz',status:'failed',bookId:null,title:null,message:'Arquivo ZIP corrompido' };
          if (window.__batchMode === 'failed') return { items:[failed] };
          const existing = books.find(book => book.id === 'test-volume');
          const already = books.find(book => book.id === 'batch-new');
          const added = already ?? { ...existing,id:'batch-new',source:'batch-source',title:'Volume 2',page:0,lastRead:null,completed:false,favorite:false,series:'',chapter:'' };
          if (!already) books.push(added);
          return { items:[
            { name:'2.cbz',status:already ? 'existing' : 'added',bookId:added.id,title:added.title,message:already ? 'Já estava na biblioteca' : 'Adicionado à biblioteca' },
            failed,
            { name:'10.cbz',status:'existing',bookId:existing.id,title:existing.title,message:'Já estava na biblioteca; dados de leitura preservados' },
          ] };
        }
        if (cmd === 'open_book') return { book: structuredClone(books[0]), pages: ['1','2','3','4','5'], bookmarks: [...bookmarks].sort((a,b) => a-b) };
        if (cmd === 'set_bookmark') { if (args.marked) bookmarks.add(args.page); else bookmarks.delete(args.page); return; }
        if (cmd === 'save_progress') { if (window.__failProgress) throw new Error('Falha simulada de disco'); Object.assign(books[0], { page: args.page, completed: args.completed, lastRead: Date.now() }); window.__testSaves.push(args); return; }
        if (cmd === 'set_favorite') { books[0].favorite = args.favorite; return; }
        if (cmd === 'update_metadata') {
          if (window.__failMetadata) throw new Error('Falha simulada ao salvar os dados do volume');
          Object.assign(books.find(book => book.id === args.id), args.metadata);
          window.__metadataWrites.push(args.metadata);
          return;
        }
        if (cmd === 'remove_book') { books.length = 0; bookmarks.clear(); return; }
        throw new Error(`Unexpected command: ${cmd}`);
      }
    };
  });
  const fixture = await readFile(new URL('../src-tauri/icons/icon.ico', import.meta.url));
  await native.route('**/__test-page.ico', route => route.fulfill({ contentType: 'image/x-icon', body: fixture }));
  await native.goto(base);
  await native.getByRole('button',{name:'Meus mangás',exact:true}).click();
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Arquivo CBZ', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume de teste', exact: true, level: 3 }).waitFor();
  await native.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('inexistente');
  await native.getByText('Nenhuma história por aqui').waitFor();
  await native.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Volume');
  await native.getByRole('button', { name: 'Favoritar Volume de teste', exact: true }).click();
  await native.getByRole('button', { name: 'Remover Volume de teste dos favoritos' }).waitFor();
  await native.getByRole('button', { name: 'Ler Volume de teste', exact: true }).click();
  await native.getByText('1 / 5', { exact: true }).waitFor();
  assert.deepEqual(await native.getByRole('alert').allTextContents(),[],'Unexpected error before reading');
  await native.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await native.getByText('2 / 5', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Marcar esta página', exact: true }).click();
  await native.getByRole('button', { name: 'Remover marcador desta página', exact: true }).waitFor();
  await native.getByLabel('Ir para a página', { exact: true }).fill('4');
  await native.getByRole('button', { name: 'Ir', exact: true }).click();
  await native.getByText('4 / 5', { exact: true }).waitFor();
  await native.getByRole('button', { name: /Páginas marcadas/ }).click();
  await native.getByRole('button', { name: 'Página 2', exact: true }).click();
  await native.getByText('2 / 5', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Opções de leitura', exact: true }).click();
  await native.getByLabel('Direção no leitor', { exact: true }).selectOption('ltr');
  assert.equal(await native.locator('.page-spread.ltr').count(), 1);
  await native.getByLabel('Direção no leitor', { exact: true }).selectOption('rtl');
  await native.getByRole('button', { name: 'Fechar painel', exact: true }).click();
  await native.getByLabel('Modo de leitura', { exact: true }).selectOption('double');
  assert.equal(await native.locator('.page-spread img').count(), 2);
  await native.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await native.getByText('4 / 5', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).click();
  await native.getByText('100% lido', { exact: false }).waitFor();
  assert.equal(await native.evaluate(() => window.__testSaves.at(-1).page), 3);
  console.log('PASS: simulated import, search, favorite, single/double reading, final spread saved');

  await native.getByRole('button', { name: 'Ler Volume de teste', exact: true }).click();
  await native.getByRole('button', { name: /Páginas marcadas/ }).click();
  await native.getByRole('button', { name: 'Página 2', exact: true }).waitFor();
  await native.getByRole('button', { name: 'Fechar painel', exact: true }).click();
  await native.evaluate(() => { window.__failProgress = true; });
  await native.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).click();
  await native.locator('.save-state.error').waitFor();
  assert.equal(await native.locator('.reader').count(), 1);
  await native.evaluate(() => { window.__failProgress = false; });
  await native.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await native.getByText('Salvo', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  console.log('PASS: bookmarks retained on reopen, page jump, reading options, failed save blocks exit and retry recovers');
  await native.getByLabel('Modo de leitura', { exact: true }).selectOption('vertical');
  assert.equal(await native.locator('.page-stack img').count(), 5);
  await native.getByLabel('Modo de leitura', { exact: true }).selectOption('webtoon');
  assert.equal(await native.locator('.reader-canvas.webtoon').count(), 1);
  await native.getByRole('button', { name: 'Alternar tela cheia',exact:true }).click();
  await native.waitForFunction(()=>window.__readerFull===true);
  await native.getByRole('button', { name: 'Ocultar controles (H)' }).click();
  assert.equal(await native.locator('.reader-header').isVisible(),false);
  assert.equal(await native.locator('.reader-footer').isVisible(),false);
  await native.getByRole('button', { name: 'Mostrar controles (H)' }).click();
  await native.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).click();
  await native.getByRole('button', { name: 'Configurações', exact: true }).click();
  await native.getByRole('checkbox').check();
  await native.getByLabel('Intervalo em minutos').fill('1');
  await native.getByRole('button', { name: 'Biblioteca' }).click();
  await native.getByRole('button',{name:'Meus mangás',exact:true}).click();
  await native.clock.install();
  await native.getByRole('button', { name: 'Ler Volume de teste', exact: true }).click();
  await native.locator('.reader-footer').waitFor();
  await native.clock.fastForward(60_000);
  await native.getByRole('dialog').getByRole('heading', { name: 'Uma pausa também faz parte.' }).waitFor();
  await native.getByRole('dialog').getByRole('button', { name: 'Voltar à biblioteca', exact: true }).click();
  console.log('PASS: Guardian reading reminder at the configured interval');
  await native.getByRole('button', { name: 'Ler Volume de teste', exact: true }).click();
  await native.getByLabel('Modo de leitura', { exact: true }).selectOption('single');
  await native.evaluate(() => { window.__failProgress = true; });
  await native.evaluate(() => window.__requestClose());
  await native.locator('.save-state.error').waitFor();
  assert.equal(await native.evaluate(() => window.__destroyed), false);
  await native.evaluate(() => { window.__failProgress = false; });
  await native.evaluate(() => window.__requestClose());
  await native.waitForFunction(() => window.__destroyed);
  assert.ok(await native.evaluate(() => window.__testSaves.length > 0));
  await native.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await native.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).click();
  console.log('PASS: simulated window close waits for save and remains open on failure');
  const readingBeforeEdit = await native.evaluate(() => ({ page: window.__testBooks[0].page, favorite: window.__testBooks[0].favorite }));
  await native.getByRole('button', { name: 'Editar Volume de teste', exact: true }).click();
  await native.getByLabel('Título do volume', { exact: true }).fill(' Volume  2 ');
  await native.getByLabel('Capítulo ou volume', { exact: true }).fill('2');
  await native.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await native.getByRole('dialog').getByRole('alert').getByText('Informe a série antes de definir o capítulo.', { exact: true }).waitFor();
  assert.equal(await native.evaluate(() => window.__metadataWrites.length), 0);
  await native.getByLabel('Série do volume', { exact: true }).fill(' Aurora  Azul ');
  await native.evaluate(() => { window.__failMetadata = true; });
  await native.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await native.getByRole('dialog').getByText('Falha simulada ao salvar os dados do volume', { exact: true }).waitFor();
  await native.evaluate(() => { window.__failMetadata = false; });
  await native.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume 2', exact: true, level: 3 }).waitFor();
  assert.deepEqual(await native.evaluate(() => ({ page: window.__testBooks[0].page, favorite: window.__testBooks[0].favorite })), readingBeforeEdit);
  await native.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('AURORA');
  await native.getByRole('heading', { name: 'Volume 2', exact: true, level: 3 }).waitFor();
  await native.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('');
  await native.getByLabel('Filtrar por série', { exact: true }).selectOption('none');
  await native.getByText('Nenhuma história por aqui').waitFor();
  await native.getByLabel('Filtrar por série', { exact: true }).selectOption('series:aurora azul');
  await native.getByRole('button', { name: 'Ver série Aurora Azul', exact: true }).click();
  assert.equal(await native.getByLabel('Ordenação', { exact: true }).inputValue(), 'chapter');
  await native.getByRole('button', { name: 'Editar Volume 2', exact: true }).click();
  await native.getByLabel('Título do volume', { exact: true }).fill('Não salvar');
  await native.getByRole('button', { name: 'Cancelar edição', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume 2', exact: true, level: 3 }).waitFor();
  await native.getByRole('button', { name: 'Editar Volume 2', exact: true }).click();
  await native.getByLabel('Título do volume', { exact: true }).fill('Volume de teste');
  await native.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume de teste', exact: true, level: 3 }).waitFor();
  await native.getByLabel('Filtrar por série', { exact: true }).selectOption('all');
  console.log('PASS: metadata validation, failed save/retry, title/series/chapter, search, series filter, cancel, reading state preserved (simulated backend)');
  await native.getByRole('button', { name: 'Configurações', exact: true }).click();
  await native.getByLabel('Tema', { exact: true }).selectOption('sepia');
  await native.getByRole('button', { name: 'Exportar dados de leitura', exact: true }).click();
  await native.getByText('Backup de leitura salvo em:', { exact: false }).waitFor();
  await native.getByLabel('Tema', { exact: true }).selectOption('light');
  await native.evaluate(() => { window.__backupMode = 'cancel'; });
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.waitForFunction(() => !document.querySelector('.backup-card button:disabled'));
  assert.equal(await native.getByRole('dialog').count(), 0);
  await native.evaluate(() => { window.__backupMode = 'invalid'; });
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.getByRole('alert').getByText('O arquivo não é um backup de leitura Yomi válido').waitFor();
  assert.equal(await native.getByRole('dialog').count(), 0);
  await native.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await native.evaluate(() => { window.__backupMode = 'valid'; });
  await native.evaluate(() => { window.__legacyBackup = true; });
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.getByRole('dialog').getByText('Este backup antigo não altera os títulos, as séries e os capítulos atuais.', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Cancelar restauração', exact: true }).click();
  await native.evaluate(() => { window.__legacyBackup = false; });
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.getByRole('dialog').getByText('Este backup também substituirá os títulos, as séries e os capítulos dos volumes compatíveis.', { exact: true }).waitFor();
  await native.getByRole('dialog').getByText('1 compatíveis', { exact: true }).waitFor();
  await native.getByRole('dialog').getByText('Volume ausente', { exact: true }).waitFor();
  await native.getByRole('button', { name: 'Cancelar restauração', exact: true }).click();
  assert.equal(await native.locator('html').getAttribute('data-theme'), 'light');
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.getByRole('checkbox', { name: 'Restaurar também as configurações', exact: true }).uncheck();
  await native.getByRole('button', { name: 'Confirmar restauração', exact: true }).click();
  await native.getByText('1 volumes restaurados;', { exact: false }).waitFor();
  assert.equal(await native.locator('html').getAttribute('data-theme'), 'light');
  await native.getByRole('button', { name: 'Selecionar backup para restaurar', exact: true }).click();
  await native.evaluate(() => { window.__failRestore = true; });
  await native.getByRole('button', { name: 'Confirmar restauração', exact: true }).click();
  await native.getByRole('alert').getByText('Falha simulada:', { exact: false }).waitFor();
  assert.equal(await native.getByRole('dialog').count(), 1);
  assert.equal(await native.locator('html').getAttribute('data-theme'), 'light');
  await native.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await native.evaluate(() => { window.__failRestore = false; });
  await native.getByRole('button', { name: 'Confirmar restauração', exact: true }).click();
  await native.getByText('Configurações restauradas.', { exact: false }).waitFor();
  await native.waitForFunction(() => document.documentElement.dataset.theme === 'sepia');
  await native.getByRole('button', { name: 'Biblioteca' }).click();
  await native.getByRole('button',{name:'Meus mangás',exact:true}).click();
  console.log('PASS: backup export, file cancellation/invalid file, preview, restore cancellation, optional settings, failure/retry (simulated backend)');
  await native.getByRole('button', { name: 'Remover Volume de teste', exact: true }).click();
  await native.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume de teste', exact: true, level: 3 }).waitFor();
  await native.getByRole('button', { name: 'Remover Volume de teste', exact: true }).click();
  await native.getByRole('button', { name: 'Remover', exact: true }).click();
  await native.getByText('Sua primeira história começa aqui').waitFor();
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Arquivo CBZ', exact: true }).click();
  await native.getByRole('heading', { name: 'Volume de teste', exact: true, level:3 }).waitFor();
  await native.evaluate(() => { window.__batchMode = 'cancel'; });
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  await native.waitForFunction(() => !document.querySelector('.import-wrap .primary-button').disabled);
  assert.equal(await native.getByRole('dialog').count(),0);
  assert.equal(await native.locator('.book-card').count(),1);
  await native.evaluate(() => { window.__batchMode = 'oversized'; });
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  await native.getByRole('alert').getByText('Selecione no máximo 50 arquivos CBZ por lote', { exact:true }).waitFor();
  assert.equal(await native.locator('.book-card').count(),1);
  await native.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await native.evaluate(() => { window.__batchMode = 'mixed'; Object.assign(window.__testBooks[0], { page:2,lastRead:123,favorite:true }); });
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  const result = native.getByRole('dialog', { name:'Resultado da importação',exact:true });
  await result.getByText('1 adicionado', { exact:true }).waitFor();
  assert.equal(await result.locator('.import-results li').count(),3);
  await result.getByLabel('Filtrar resultado da importação', { exact:true }).selectOption('failed');
  assert.equal(await result.locator('.import-results li').count(),1);
  await result.getByText('Arquivo ZIP corrompido', { exact:true }).waitFor();
  await result.getByLabel('Filtrar resultado da importação', { exact:true }).selectOption('all');
  await result.getByRole('button', { name:'Fechar resultado',exact:true }).click();
  assert.equal(await native.locator('.book-card').count(),2);
  assert.equal(await native.evaluate(() => window.__testBooks[0].page),2);
  assert.equal(await native.evaluate(() => window.__testBooks[0].favorite),true);
  await native.getByRole('button', { name:'Ver resultado do último lote (3 arquivos)',exact:true }).click();
  assert.equal(await result.locator('.import-results li').count(),3);
  await result.getByRole('button', { name:'Fechar resultado',exact:true }).click();
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  await result.getByText('0 adicionados', { exact:true }).waitFor();
  await result.getByText('2 já existentes', { exact:true }).waitFor();
  await result.getByRole('button', { name:'Fechar resultado',exact:true }).click();
  assert.equal(await native.locator('.book-card').count(),2);
  await native.evaluate(() => { window.__batchMode = 'failed'; });
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  await result.getByText('1 falha', { exact:true }).waitFor();
  await result.getByRole('button', { name:'Fechar resultado',exact:true }).click();
  assert.equal(await native.locator('.book-card').count(),2);
  console.log('PASS: batch cancellation, rejected selection, mixed report, filtering, reopen, duplicate retry and all-failed batch (simulated backend)');
  await native.evaluate(() => { window.__batchMode = 'held'; window.__destroyed = false; });
  await native.getByRole('button', { name: 'Importar mangá', exact: true }).click();
  await native.getByRole('button', { name: 'Vários arquivos CBZ', exact: true }).click();
  await native.waitForFunction(() => typeof window.__finishBatch === 'function');
  assert.equal(await native.getByRole('button', { name:'Configurações',exact:true }).isDisabled(),true);
  await native.evaluate(() => window.__requestClose());
  assert.equal(await native.evaluate(() => window.__destroyed),false);
  await native.evaluate(() => window.__finishBatch());
  await native.waitForFunction(() => window.__destroyed);
  await result.getByRole('button', { name:'Fechar resultado',exact:true }).click();
  console.log('PASS: simulated window close waits for an in-flight batch import');
  await native.setViewportSize({ width: 700, height: 700 });
  assert.equal(await native.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  console.log('PASS: vertical/webtoon, reader controls, removal/cancel, narrow layout');
  assert.deepEqual(errors, []);
  console.log('PASS: no browser exceptions');
  await context.close();
} finally { await browser.close(); }
