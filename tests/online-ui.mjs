import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: process.env.YOMI_BROWSER_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.addInitScript(() => {
    const books = JSON.parse(localStorage.getItem('test-books') ?? '[]'), callbacks = new Map(); let id = 0;
    const listeners = new Map(); let nextListener = 1;
    window.__destroyed = false;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_event, id) => listeners.delete(id) };
    window.__requestClose = async () => { for (const [id, listener] of listeners) if (listener.event === 'tauri://close-requested') await callbacks.get(listener.handler)({ event: listener.event, id, payload: null }); };
    window.__queueMode = localStorage.getItem('test-queue-mode') === '1'; window.__queueIds = [9,10,11]; window.__queueOrder = []; window.__queueFailure = true; window.__holdChapter = 0; window.__books = books;
    window.isTauri = true; window.__searches = []; window.__failConnect = true; window.__downloads = 0; window.__cancelMode = true;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback: callback => { callbacks.set(++id, callback); return id; },
      convertFileSrc: () => '/missing-test-cover.png',
      invoke: async (cmd, args) => {
        if(cmd === 'get_saved_queue') return JSON.parse(localStorage.getItem('test-queue') ?? '{"revision":0,"queue":null}');
        if(cmd === 'save_download_queue') { if(window.__failQueueSave)throw 'Falha ao salvar fila';const current=JSON.parse(localStorage.getItem('test-queue') ?? '{"revision":0,"queue":null}'); if(current.revision!==args.expectedRevision) throw 'Fila alterada'; const record={revision:current.revision+1,queue:args.queue};localStorage.setItem('test-queue',JSON.stringify(record));return record; }
        if (cmd === 'plugin:event|listen') { const id = nextListener++; listeners.set(id, args); return id; }
        if (cmd === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
        if (cmd === 'plugin:window|destroy') { window.__destroyed = true; return; }
        if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if (cmd === 'list_site_readings') return []; if(cmd==='set_site_layout')return;
        if (cmd === 'list_books') return structuredClone(books);
        if (cmd === 'get_settings') return { guardian: false };
        if (cmd === 'save_settings' || cmd.startsWith('plugin:')) return 1;
        if (cmd === 'suwayomi_connect') { if (window.__failConnect) throw 'Servidor indisponível'; return { server: 'http://127.0.0.1:4567/', name: 'Suwayomi', version: 'test', sources: [{ id: '0', name: 'Local', lang: 'all' }, { id: '9223372036854775807', name: 'Fonte Teste', lang: 'pt' }] }; }
        if (cmd === 'suwayomi_logout') return;
        if (cmd === 'suwayomi_session') return false;
        if (cmd === 'suwayomi_cover') throw 'Sem capa';
        if (cmd === 'suwayomi_search') { window.__searches.push(args); return { hasNextPage: args.page === 1, mangas: [{ id: 42, title: 'Mangá de teste' }] }; }
        if (cmd === 'suwayomi_chapters') return { manga: { id: 42, title: 'Mangá de teste' }, chapters: window.__queueMode ? window.__queueIds.map(id => ({id,name:`Capítulo ${id}`,chapterNumber:id})) : [{ id: 8, name: 'Capítulo 1', chapterNumber: 1 }] };
        if (cmd === 'prepare_download') return 'job-test';
        if (cmd === 'download_progress') return { completed: 1, total: 2, bytes: 1024, cancelled: false, finished: false };
        if (cmd === 'cancel_download') { window.__rejectDownload('Download cancelado'); return true; }
        if (cmd === 'suwayomi_download' && window.__queueMode) {
          window.__queueOrder.push(args.chapterId);
          if (args.chapterId === window.__holdChapter) return new Promise((_resolve,reject) => { window.__rejectDownload = reject; });
          if (args.chapterId === 10 && window.__queueFailure) throw 'Fonte temporariamente indisponível';
          const source = `suwayomi:http://127.0.0.1:4567/#manga:42:chapter:${args.chapterId}`;
          let book = books.find(book => book.source === source);
          if (!book) { book = { id: `chapter-${args.chapterId}`, title: `Teste · Capítulo ${args.chapterId}`, series: 'Teste', chapter: String(args.chapterId), format: 'online', source, cover: '', pageCount: 1, page: 0, completed: false, favorite: false, addedAt: args.chapterId, lastRead: null }; books.push(book); }
          return structuredClone(book);
        }
        if (cmd === 'suwayomi_download' && window.__cancelMode) { window.__downloads++; return new Promise((_resolve,reject) => { window.__rejectDownload = reject; }); }
        if (cmd === 'suwayomi_download') { window.__downloads++; if (!books.length) books.push({ id: 'online-test', title: 'Mangá de teste · Capítulo 1', series: 'Mangá de teste', chapter: 'Capítulo 1', format: 'online', source: 'suwayomi:http://127.0.0.1:4567/#manga:42:chapter:8', cover: '', pageCount: 1, page: 0, completed: false, favorite: false, addedAt: 1, lastRead: null }); return structuredClone(books[0]); }
        if (cmd === 'open_book') return { book: structuredClone(books[0]), pages: ['/missing-test-page.png'], bookmarks: [] };
        if (cmd === 'save_progress') return;
        throw new Error(`Comando inesperado: ${cmd}`);
      },
    };
  });
  await page.goto(process.env.YOMI_TEST_URL ?? 'http://127.0.0.1:1423');
  await page.getByRole('button', { name: 'Fontes online', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.getByRole('alert').getByText('Servidor indisponível').waitFor();
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await page.evaluate(() => { window.__failConnect = false; });
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.getByText('Conectado a Suwayomi test · 2 fontes').waitFor();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).waitFor();
  assert.equal((await page.evaluate(() => window.__searches))[0].source, '0');
  await page.getByLabel('Nome do mangá', { exact: true }).fill('Ainda não buscado');
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await page.getByText('Página 2 · 1 resultados').waitFor();
  assert.equal((await page.evaluate(() => window.__searches))[1].query, '');
  assert.equal(await page.getByRole('button', { name: 'Próxima', exact: true }).isDisabled(), true);
  await page.getByLabel('Fonte', { exact: true }).selectOption('9223372036854775807');
  assert.equal(await page.getByRole('button', { name: /Mangá de teste/ }).count(), 0);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).click();
  await page.getByRole('button', { name: 'Baixar e ler', exact: true }).click();
  await page.getByText(/50% · 1 de 2 páginas/).waitFor();
  await page.getByRole('button', { name: 'Cancelar download', exact: true }).click();
  await page.getByText('Download cancelado. Nenhum capítulo incompleto foi adicionado.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Voltar à biblioteca' }).count(), 0);
  await page.evaluate(() => { window.__cancelMode = false; });
  await page.getByRole('button', { name: 'Baixar e ler', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
  await page.getByRole('heading', { name: /Sua biblioteca/ }).waitFor();
  await page.getByText('Mangá de teste · Capítulo 1', { exact: true }).first().waitFor();
  assert.equal(await page.evaluate(() => window.__downloads), 2);
  await page.evaluate(() => { window.__queueMode = true; });
  await page.getByRole('button', { name: 'Fontes online', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).click();
  await page.getByRole('button', { name: 'Selecionar até 50', exact: true }).click();
  await page.getByRole('button', { name: 'Baixar selecionados (3)', exact: true }).click();
  await page.getByText('Fila encerrada · Salvos: 2 · Falhas: 1 · Pendentes: 0').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__queueOrder), [9,10,11]);
  assert.equal(await page.getByLabel('Selecionar Capítulo 9', { exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Voltar à biblioteca', exact: true }).count(), 0);
  await page.evaluate(() => { window.__queueFailure = false; });
  await page.getByRole('button', { name: 'Tentar pendentes novamente', exact: true }).click();
  await page.getByText('Fila encerrada · Salvos: 1 · Falhas: 0 · Pendentes: 0').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__queueOrder), [9,10,11,10]);
  await page.evaluate(() => { window.__queueIds = [12,13,14]; window.__holdChapter = 13; });
  await page.getByRole('button', { name: '← Voltar aos resultados', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).click();
  await page.getByRole('button', { name: 'Selecionar até 50', exact: true }).click();
  await page.getByRole('button', { name: 'Baixar selecionados (3)', exact: true }).click();
  await page.getByRole('region', { name: 'Fila de capítulos' }).getByText('Baixando', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__queueOrder.at(-1) === 13);
  await page.getByRole('button', { name: 'Cancelar fila', exact: true }).click();
  await page.getByText('Fila encerrada · Salvos: 1 · Falhas: 0 · Pendentes: 2').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__queueOrder), [9,10,11,10,12,13]);
  assert.equal(await page.evaluate(() => window.__books.some(book => book.id === 'chapter-12')), true);
  assert.equal(await page.evaluate(() => window.__books.some(book => book.id === 'chapter-13')), false);
  await page.evaluate(() => { window.__holdChapter = 0; });
  await page.getByRole('button', { name: 'Tentar pendentes novamente', exact: true }).click();
  await page.getByText('Fila encerrada · Salvos: 2 · Falhas: 0 · Pendentes: 0').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__queueOrder), [9,10,11,10,12,13,13,14]);
  await page.evaluate(() => { window.__queueIds = Array.from({length:60},(_,index) => index + 100); });
  await page.getByRole('button', { name: '← Voltar aos resultados', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).click();
  await page.setViewportSize({ width:680, height:860 });
  await page.getByRole('button', { name: 'Selecionar até 50', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { checked:true }).count(), 50);
  assert.equal(await page.getByLabel('Selecionar Capítulo 150', { exact:true }).isDisabled(), true);
  await page.getByLabel('Selecionar Capítulo 100', { exact:true }).uncheck();
  await page.getByLabel('Selecionar Capítulo 150', { exact:true }).check();
  assert.equal(await page.getByRole('checkbox', { checked:true }).count(), 50);
  await page.getByRole('button', { name: 'Limpar seleção', exact:true }).click();
  assert.equal(await page.getByRole('button', { name: 'Baixar selecionados (0)', exact:true }).isDisabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { window.__queueIds = [15,16,17]; window.__holdChapter = 16; });
  await page.getByRole('button', { name: '← Voltar aos resultados', exact: true }).click();
  await page.getByRole('button', { name: /Mangá de teste/ }).click();
  await page.getByRole('button', { name: 'Selecionar até 50', exact: true }).click();
  await page.getByRole('button', { name: 'Baixar selecionados (3)', exact:true }).click();
  await page.waitForFunction(() => window.__queueOrder.at(-1) === 16);
  assert.equal(await page.getByRole('button', { name:'Biblioteca', exact:false }).first().isDisabled(), true);
  const cancelBox = await page.getByRole('button', { name:'Cancelar fila', exact:true }).boundingBox();
  assert.ok(cancelBox && cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= 860);
  await page.evaluate(() => window.__requestClose());
  assert.equal(await page.evaluate(() => window.__destroyed), false);
  await page.getByRole('button', { name:'Cancelar fila', exact:true }).click();
  await page.waitForFunction(() => window.__destroyed);
  assert.deepEqual((await page.evaluate(() => window.__queueOrder)).slice(-2), [15,16]);
  await page.evaluate(() => {
    const saved={...window.__books[0],id:'chapter-200',source:'suwayomi:http://127.0.0.1:4567/#manga:42:chapter:200'};
    localStorage.setItem('test-books',JSON.stringify([...window.__books,saved]));localStorage.setItem('test-queue-mode','1');
    localStorage.setItem('test-queue',JSON.stringify({revision:100,queue:{server:'http://127.0.0.1:4567/',mangaId:42,title:'Fila interrompida',items:[{id:200,name:'Capítulo 200',status:'downloading'},{id:201,name:'Capítulo 201',status:'queued'}]}}));
  });
  await page.reload();
  await page.getByRole('button',{name:'Fontes online',exact:true}).click();
  await page.getByText('Fila interrompida',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__queueOrder),[]);
  await page.getByRole('button',{name:'Retomar fila salva',exact:true}).click();
  await page.getByText('Fila encerrada · Salvos: 1 · Falhas: 0 · Pendentes: 0').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__queueOrder),[201]);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-queue')).queue),null);
  const booksBeforeDiscard = await page.evaluate(()=>window.__books.map(book=>book.id));
  await page.evaluate(()=>localStorage.setItem('test-queue',JSON.stringify({revision:150,queue:{server:'http://127.0.0.1:4567/',mangaId:42,title:'Fila para descartar',items:[{id:202,name:'Capítulo 202',status:'queued'}]}})));
  await page.getByRole('button',{name:'Recarregar fila',exact:true}).click();
  await page.getByText('Fila para descartar',{exact:true}).waitFor();
  await page.evaluate(()=>{const record=JSON.parse(localStorage.getItem('test-queue'));record.revision++;localStorage.setItem('test-queue',JSON.stringify(record));});
  await page.getByRole('button',{name:'Descartar fila',exact:true}).click();
  await page.getByRole('alert').getByText('Fila alterada',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-queue')).queue.title),'Fila para descartar');
  await page.getByRole('button',{name:'Fechar aviso',exact:true}).click();
  await page.getByRole('button',{name:'Recarregar fila',exact:true}).click();
  await page.getByRole('button',{name:'Descartar fila',exact:true}).click();
  await page.getByText('Fila descartada. Os capítulos já salvos foram preservados.').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__books.map(book=>book.id)),booksBeforeDiscard);
  await page.evaluate(()=>{window.__queueIds=[300,301];window.__failQueueSave=true;window.__failConnect=false;});
  await page.getByRole('button',{name:'Conectar',exact:true}).click();
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByRole('button',{name:/Mangá de teste/}).click();
  await page.getByRole('button',{name:'Selecionar até 50',exact:true}).click();
  await page.getByRole('button',{name:'Baixar selecionados (2)',exact:true}).click();
  await page.getByRole('alert').getByText('Falha ao salvar fila',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__queueOrder),[201]);
  await page.evaluate(()=>{window.__failQueueSave=false;});
  await page.getByRole('button',{name:'Fechar aviso',exact:true}).click();
  await page.getByRole('button',{name:'Tentar pendentes novamente',exact:true}).click();
  await page.getByText('Fila encerrada · Salvos: 2 · Falhas: 0 · Pendentes: 0').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__queueOrder),[201,300,301]);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: online reader/queue, cancel/retry, limit 50, close waits, restart/manual recovery, committed chapters skipped, stale write rejected and discard preserves books (mocked transport)');
} finally { await browser.close(); }




