import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Real IPC + controlled HTTP transport: cancellation after one downloaded page.
export async function testNativeDownload(page) {
  const png = await readFile('node_modules/playwright-core/lib/server/chromium/appIcon.png');
  let secondResponse;
  let signalSecond;
  const secondRequested = new Promise(resolve => { signalSecond = resolve; });
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/api/graphql') {
      for await (const _chunk of request) { /* Drain the request. */ }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ data: { fetchChapterPages: { chapter: { id: 8, name: 'Cancel test', manga: { id: 42, title: 'Native cancellation test' } }, pages: ['/api/v1/manga/42/chapter/0/page/0', '/api/v1/manga/42/chapter/0/page/1'] } } }));
    } else if (request.url === '/api/v1/manga/42/chapter/0/page/0') {
      response.setHeader('Content-Type', 'image/png'); response.end(png);
    } else if (request.url === '/api/v1/manga/42/chapter/0/page/1') {
      secondResponse = response; signalSecond();
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const before = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('list_books'));
  const dataRoot = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:path|resolve_directory', { directory: 14 }));
  const beforeFolders = (await readdir(path.join(dataRoot, 'library'))).sort();
  let jobId;
  let timer;
  try {
    jobId = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('prepare_download'));
    await page.evaluate(({ server, jobId }) => {
      window.__nativeDownloadPromise = window.__TAURI_INTERNALS__.invoke('suwayomi_download', { server, mangaId: 42, chapterId: 8, jobId }).then(book => ({ book }), error => ({ error: String(error) }));
    }, { server: address, jobId });
    await Promise.race([secondRequested, new Promise((_resolve,reject) => { timer = setTimeout(() => reject(new Error('A segunda página não foi solicitada')), 12000); })]);
    clearTimeout(timer);
    const progress = await page.evaluate(jobId => window.__TAURI_INTERNALS__.invoke('download_progress', { jobId }), jobId);
    assert.equal(progress.completed, 1); assert.equal(progress.total, 2); assert.equal(progress.bytes, png.length);
    assert.equal(await page.evaluate(jobId => window.__TAURI_INTERNALS__.invoke('cancel_download', { jobId }), jobId), true);
    secondResponse.end(png);
    const result = await page.evaluate(() => window.__nativeDownloadPromise);
    assert.equal(result.error, 'Download cancelado');
    assert.deepEqual(await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('list_books')), before);
    assert.deepEqual((await readdir(path.join(dataRoot, 'library'))).sort(), beforeFolders);
    assert.equal(await page.evaluate(jobId => window.__TAURI_INTERNALS__.invoke('cancel_download', { jobId }), jobId), false);
    console.log('PASS: real native progress (1/2 pages and bytes), cancellation, partial-file cleanup, unchanged library and released job');
  } finally {
    clearTimeout(timer);
    if (jobId) await page.evaluate(jobId => window.__TAURI_INTERNALS__.invoke('cancel_download', { jobId }), jobId).catch(() => {});
    secondResponse?.end(png);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await page.evaluate(async () => { await window.__nativeDownloadPromise; delete window.__nativeDownloadPromise; }).catch(() => {});
  }
}
