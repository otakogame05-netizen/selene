import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { openSync,closeSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const [binary,root]=process.argv.slice(2);
assert.ok(path.isAbsolute(binary)&&path.isAbsolute(root));
const data=path.join(root,'data');await mkdir(data,{recursive:true});
const endpoint='http://127.0.0.1:9224';
const png=await readFile('node_modules/playwright-core/lib/server/chromium/appIcon.png');
const ids=[101,102,103];const title='Teste de recuperação nativa';
const basic=process.env.YOMI_TEST_BASIC_AUTH==='1';const username='yomi-fixture-user';const password=randomUUID();const authorization=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;let unauthorized=0;let requests=0;
const counts=new Map();let phase='interrupt';let held;let reachedSecond;
const secondBlocked=new Promise(resolve=>{reachedSecond=resolve;});
let child,browser,page;let launches=0;
const errors=[];
const server=createServer(async(request,response)=>{
  requests++;
  if(basic&&request.headers.authorization!==authorization){unauthorized++;request.resume();response.writeHead(401,{'WWW-Authenticate':'Basic realm="Yomi test"'});response.end('Unauthorized');return;}
  if(request.method==='POST'&&request.url==='/api/graphql'){
    let body='';for await(const chunk of request)body+=chunk;
    const {query,variables}=JSON.parse(body);let result;
    if(query.includes('YomiConnection'))result={aboutServer:{name:'Controlled HTTP fixture',version:'1'},sources:{nodes:[{id:'0',name:'Test source',lang:'all'}]}};
    else if(query.includes('YomiSearch'))result={fetchSourceManga:{hasNextPage:false,mangas:[{id:42,title}]}};
    else if(query.includes('YomiChapters'))result={fetchMangaAndChapters:{manga:{id:42,title},chapters:ids.map((id,index)=>({id,name:`Capítulo ${index+1}`,chapterNumber:index+1}))}};
    else if(query.includes('YomiPages')){
      const id=variables.input.chapterId;assert.ok(ids.includes(id));counts.set(id,(counts.get(id)??0)+1);
      const index=id-101;result={fetchChapterPages:{chapter:{id,name:`Capítulo ${index+1}`,manga:{id:42,title}},pages:[0,1].map(page=>`/api/v1/manga/42/chapter/${index}/page/${page}`)}};
    }
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result?{data:result}:{errors:[{message:'Unknown fixture operation'}]}));return;
  }
  if(request.url==='/api/v1/manga/42/thumbnail'){response.setHeader('Content-Type','image/png');response.end(png);return;}
  const match=request.url?.match(/^\/api\/v1\/manga\/42\/chapter\/(\d+)\/page\/([01])$/);
  if(match){
    if(phase==='interrupt'&&match[1]==='1'&&match[2]==='1'){held=response;reachedSecond();return;}
    response.setHeader('Content-Type','image/png');response.end(png);return;
  }
  response.writeHead(404);response.end();
});
const exec=promisify(execFile);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function killOwnProcess(){
  if(child&&child.exitCode===null){await exec('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});for(let i=0;i<30&&child.exitCode===null;i++)await pause(100);assert.notEqual(child.exitCode,null);}
  await browser?.close().catch(()=>{});browser=null;
}
async function launch(){
  const fd=openSync(path.join(root,'native.log'),'a');
  child=spawn(binary,['--data-dir',data],{windowsHide:true,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9224',WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview')},stdio:['ignore',fd,fd]});closeSync(fd);
  let startupError;child.on('error',error=>{startupError=error;});
  let ready=false;
  for(let i=0;i<75;i++){
    if(startupError)throw startupError;assert.equal(child.exitCode,null,'O aplicativo encerrou durante a inicialização');
    try{const response=await fetch(`${endpoint}/json/version`,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}
    await pause(300);
  }
  assert.ok(ready,'WebView2 não iniciou');browser=await chromium.connectOverCDP(endpoint);page=browser.contexts().flatMap(context=>context.pages())[0];
  page.on('pageerror',error=>errors.push(error.message));await page.getByRole('button',{name:'Meus mangás',exact:true}).click();await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
  const actual=await invoke('get_data_location');assert.equal(path.resolve(actual).toLowerCase(),path.resolve(data).toLowerCase(),'O teste deve usar somente a pasta isolada');launches++;
}
function invoke(command,args){return page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});}
async function login(secret=password){await page.getByLabel('Autenticação',{exact:true}).selectOption('basic');await page.getByLabel('Usuário Suwayomi',{exact:true}).fill(username);await page.getByLabel('Senha Suwayomi',{exact:true}).fill(secret);await page.getByRole('button',{name:'Conectar',exact:true}).click();}
async function finishNormally(){
  await invoke('plugin:window|destroy').catch(()=>{});for(let i=0;i<50&&child.exitCode===null;i++)await pause(100);
  assert.notEqual(child.exitCode,null,'A janela de teste não encerrou normalmente');await browser.close().catch(()=>{});browser=null;
}
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=`http://127.0.0.1:${server.address().port}`;
  await launch();assert.deepEqual(await invoke('list_books'),[]);
  await page.getByRole('button',{name:'Fontes online',exact:true}).click();
  await page.getByLabel('Endereço do servidor',{exact:true}).fill(address);
  if(basic){
    await login('intentionally-wrong');await page.getByRole('alert').getByText('Autenticação necessária no Suwayomi. Entre novamente em Fontes online.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Senha Suwayomi',{exact:true}).inputValue(),'');assert.equal(await invoke('suwayomi_session',{server:address}),false);await page.getByRole('button',{name:'Fechar aviso',exact:true}).click();
    await login();
  }else await page.getByRole('button',{name:'Conectar',exact:true}).click();
  if(basic){
    await page.getByLabel('Fonte',{exact:true}).waitFor();await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await page.getByRole('button',{name:'Fontes online',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[aria-label="Autenticação"]')?.value==='basic');assert.equal(await page.getByLabel('Senha Suwayomi',{exact:true}).inputValue(),'');
    await page.getByRole('button',{name:'Conectar',exact:true}).click();await page.getByLabel('Fonte',{exact:true}).waitFor();assert.equal(await invoke('suwayomi_session',{server:address}),true);
  }
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByRole('button',{name:new RegExp(`Ver capítulos de ${title}`)}).click();
  await page.getByRole('button',{name:'Selecionar até 50',exact:true}).click();
  await page.getByRole('button',{name:'Baixar selecionados (3)',exact:true}).click();
  let timer;try{await Promise.race([secondBlocked,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Segundo capítulo não chegou à página bloqueada')),15000);})]);}finally{clearTimeout(timer);}
  const before=await invoke('list_books');assert.equal(before.length,1);assert.ok(before[0].source.endsWith(':chapter:101'));
  const interrupted=await invoke('get_saved_queue');assert.equal(interrupted.queue.items[1].status,'downloading');
  await killOwnProcess();phase='resume';held?.end(png);held=undefined;
  const requestsBeforeRestart=[...counts.entries()];
  const allRequestsBeforeRestart=requests;
  await launch();await page.getByRole('button',{name:'Fontes online',exact:true}).click();
  await page.getByRole('button',{name:'Retomar fila salva',exact:true}).waitFor();
  assert.deepEqual([...counts.entries()],requestsBeforeRestart,'Abrir o aplicativo não deve iniciar downloads');
  assert.equal(requests,allRequestsBeforeRestart,'Abrir a tela não deve iniciar consultas remotas');
  if(basic){
    assert.equal(await invoke('suwayomi_session',{server:address}),false);
    const denied=unauthorized;await page.getByRole('button',{name:'Retomar fila salva',exact:true}).click();
    await page.getByText('Fila encerrada · Salvos: 0 · Falhas: 1 · Pendentes: 1').waitFor();assert.equal(unauthorized,denied+1,'A fila deve parar na primeira recusa de autenticação');
    await login();await page.getByLabel('Fonte',{exact:true}).waitFor();
  }
  await page.getByRole('button',{name:'Retomar fila salva',exact:true}).click();
  await page.getByText('Fila encerrada · Salvos: 2 · Falhas: 0 · Pendentes: 0').waitFor();
  const books=await invoke('list_books');assert.equal(books.length,3);assert.equal(books.find(book=>book.id===before[0].id)?.id,before[0].id);assert.equal(counts.get(101),1);assert.equal(counts.get(102),2);assert.equal(counts.get(103),1);
  assert.equal((await invoke('get_saved_queue')).queue,null);
  if(basic){
    for(const name of (await readdir(data)).filter(name=>name.includes('.sqlite3'))){const bytes=await readFile(path.join(data,name));assert.equal(bytes.includes(Buffer.from(password)),false);assert.equal(bytes.includes(Buffer.from(authorization)),false);}
    await page.getByRole('button',{name:'Sair do Suwayomi',exact:true}).click();await page.getByText('Sessões do Suwayomi encerradas. Os capítulos locais e a fila foram preservados.').waitFor();assert.equal(await invoke('suwayomi_session',{server:address}),false);assert.equal((await invoke('list_books')).length,3);
  }
  await page.getByRole('button',{name:'Biblioteca',exact:true}).click();
  await page.getByRole('button',{name:`Ler ${title} · Capítulo 1`,exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.reader img')].some(image=>image.naturalWidth===400));
  await page.getByRole('button',{name:'Próxima página',exact:true}).click();
  await page.locator('.page-counter').getByText('2 / 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Voltar à biblioteca',exact:true}).click();
  await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
  assert.equal((await invoke('list_books')).find(book=>book.id===before[0].id).page,1);
  await finishNormally();await launch();
  const restored=await invoke('list_books');const first=restored.find(book=>book.id===before[0].id);assert.equal(first.page,1);assert.equal(first.completed,true);
  const folders=(await readdir(path.join(data,'library'),{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^[0-9a-f-]{36}$/i.test(entry.name)).map(entry=>entry.name);
  const orphans=folders.filter(id=>!restored.some(book=>book.id===id));
  const result={launches,bookCount:restored.length,pageRequests:Object.fromEntries(counts),recoveredQueue:true,duplicateCompletedChapter:false,readingProgressRestored:true,basicAuthentication:basic,unauthorizedRequests:unauthorized,credentialsFoundInAppDatabases:false,orphanDirectories:orphans,errors};
  await writeFile(path.join(root,'result.json'),JSON.stringify(result,null,2));
  assert.deepEqual(orphans,[],'Arquivos parciais da interrupção devem ser removidos ao retomar');assert.deepEqual(errors,[]);
  await finishNormally();console.log(`PASS: real native UI queue/recovery, no duplicates/orphans, reading after restart${basic?', Basic login failure/retry, RAM-only session lost on restart, authenticated images, auth failure pauses queue, logout and no credentials in app databases':''}`);
}finally{held?.end(png);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await killOwnProcess();}
