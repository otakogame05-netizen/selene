import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
const root=path.resolve('.test-results',`native-stream-${randomUUID()}`);await mkdir(root,{recursive:true});
const png=await readFile('node_modules/playwright-core/lib/server/chromium/appIcon.png');
const counts=[0,0,0];let app,browser,success=false;
const http=createServer(async(req,res)=>{
 if(req.url==='/api/graphql'){
  let body='';for await(const chunk of req)body+=chunk;const {query}=JSON.parse(body);let data;
  if(query.includes('YomiConnection'))data={aboutServer:{name:'Stream test',version:'1'},sources:{nodes:[{id:'0',name:'Local',lang:'all'},{id:'99',name:'Fonte persistida',lang:'pt'}]}};
  else if(query.includes('YomiSearch'))data={fetchSourceManga:{hasNextPage:false,mangas:[{id:42,title:'Capítulo progressivo'}]}};
  else if(query.includes('YomiChapters'))data={fetchMangaAndChapters:{manga:{id:42,title:'Capítulo progressivo'},chapters:[{id:8,name:'Capítulo 1',chapterNumber:1}]}};
  else if(query.includes('YomiPages'))data={fetchChapterPages:{chapter:{id:8,name:'Capítulo 1',manga:{id:42,title:'Capítulo progressivo'}},pages:[0,1,2].map(i=>`/api/v1/manga/42/chapter/0/page/${i}`)}};
  else throw new Error(query);
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data}));return;
 }
 const match=req.url.match(/\/page\/(\d+)$/);if(match)counts[Number(match[1])]++;
 res.writeHead(200,{'content-type':'image/png'});res.end(png);
});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));const server=`http://127.0.0.1:${http.address().port}/`;
const endpoint='http://127.0.0.1:9226';
async function launch(){
 app=spawn(process.env.YOMI_TEST_BINARY,['--data-dir',path.join(root,'data')],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:path.join(root,`profile-${randomUUID()}`),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9226'}});
 for(let i=0;i<100;i++){try{if((await fetch(`${endpoint}/json/version`,{signal:AbortSignal.timeout(300)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.connectOverCDP(endpoint);const page=browser.contexts()[0].pages()[0];
 await page.getByRole('button',{name:'Meus mangás',exact:true}).click();await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
 assert.equal(path.resolve(await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_data_location'))),path.join(root,'data'));
 return page;
}
async function close(page){await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})).catch(error=>{if(!String(error).includes('closed'))throw error;});await browser.close();browser=null;await new Promise(r=>setTimeout(r,500));}
try{
 let page=await launch();await page.getByRole('button',{name:'Fontes online',exact:true}).click();
 await page.getByLabel('Endereço do servidor',{exact:true}).fill(server);await page.getByRole('button',{name:'Conectar',exact:true}).click();
 await page.getByLabel('Fonte',{exact:true}).selectOption('99');
  if(process.env.YOMI_TEST_LIBRARY_CATALOG==='1'){
    await page.getByRole('button',{name:'Biblioteca',exact:true}).click();
    await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).click();
    await page.getByRole('button',{name:/Ver capítulos de Capítulo progressivo/}).waitFor();
    assert.equal(await page.getByLabel('Fonte',{exact:true}).inputValue(),'99');
    assert.equal(await page.getByRole('heading',{name:'Extensões',exact:true}).count(),0);
  }
 async function chapters(){await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.getByRole('button',{name:/Ver capítulos de Capítulo progressivo/}).click();}
 await chapters();await page.getByRole('button',{name:'Ler online',exact:true}).click();
 await page.getByAltText('Página 1',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('img[alt="Página 1"]')?.naturalWidth===400);
 assert.deepEqual(counts,[1,0,0]);
 const book=(await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('list_books')))[0];assert.equal(book.format,'stream');
 await page.getByRole('button',{name:'Próxima página',exact:true}).click();await page.waitForFunction(()=>document.querySelector('img[alt="Página 2"]')?.naturalWidth===400);
 assert.deepEqual(counts,[1,1,0]);
  await page.getByLabel('Modo de leitura',{exact:true}).selectOption('double');
  await page.waitForFunction(()=>document.querySelector('img[alt="Página 3"]')?.naturalWidth===400);
  assert.deepEqual(counts,[1,1,1]);
  for(const mode of ['vertical','webtoon']){
    await page.getByLabel('Modo de leitura',{exact:true}).selectOption(mode);
    await page.waitForFunction(()=>document.querySelector('.reader-canvas.scroll-mode img')?.naturalWidth===400);
  }
  await page.getByLabel('Modo de leitura',{exact:true}).selectOption('single');
 await page.getByRole('button',{name:'Voltar à biblioteca',exact:true}).click();
  await page.getByRole('button',{name:'Fontes online',exact:true}).click();
 await page.getByRole('button',{name:'Conectar',exact:true}).click();await chapters();
 await page.getByRole('button',{name:'Baixar e ler',exact:true}).click();await page.getByAltText('Página 2',{exact:true}).waitFor();
 const books=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('list_books'));assert.equal(books.length,1);assert.equal(books[0].id,book.id);assert.equal(books[0].format,'online');assert.deepEqual(counts,[1,1,1]);
 await close(page);await new Promise(resolve=>http.close(resolve));
 page=await launch();const preferences=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_settings'));assert.equal(preferences.onlineSource,'99');
 await page.getByRole('button',{name:/Ler Capítulo progressivo/}).click();await page.waitForFunction(()=>document.querySelector('img[alt="Página 2"]')?.naturalWidth===400);
 await close(page);success=true;
 console.log('PASS: real online reader fetches 1/3 then 2/3 on demand; full download reuses cache without duplicates; source and progress survive restart; offline image decodes');
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(app?.exitCode===null){try{execFileSync('taskkill',['/PID',String(app.pid),'/F'],{stdio:'ignore',windowsHide:true});}catch{}}
 http.close();
 if(success){assert.ok(root.startsWith(path.resolve('.test-results')+path.sep));await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:300});}else console.error(`Diagnostic data preserved: ${root}`);
}
