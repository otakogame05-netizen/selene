import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
const root=path.resolve('.test-results',`native-engine-${randomUUID()}`);
await mkdir(root,{recursive:true});
const binary=process.env.YOMI_TEST_BINARY;
assert.ok(binary,'YOMI_TEST_BINARY must point to the release app');
const endpoint='http://127.0.0.1:9225';
try{await fetch(`${endpoint}/json/version`,{signal:AbortSignal.timeout(500)});throw new Error('Port 9225 already in use');}catch(error){if(error.message.includes('already in use'))throw error;}
let app,browser,server;let successful=false;
async function waitClosed(){for(let i=0;i<40;i++){try{await fetch(`${server}api/graphql`,{signal:AbortSignal.timeout(300)});}catch{return;}await new Promise(r=>setTimeout(r,200));}throw new Error('Integrated engine remained running after app exit');}
async function open(){
  app=spawn(binary,['--data-dir',path.join(root,'data')],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9225',WEBVIEW2_USER_DATA_FOLDER:path.join(root,`profile-${randomUUID()}`)}});
  for(let i=0;i<150;i++){if(app.exitCode!==null)throw new Error(`App exited ${app.exitCode}`);try{const response=await fetch(`${endpoint}/json/version`,{signal:AbortSignal.timeout(400)});if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.connectOverCDP(endpoint);const page=browser.contexts()[0].pages()[0];
  await page.getByRole('button',{name:'Meus mangás',exact:true}).click();await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
  const actual=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_data_location'));
  assert.equal(path.resolve(actual),path.join(root,'data'));
  await page.getByRole('button',{name:'Fontes online',exact:true}).click();
  if(!server)await page.getByRole('button',{name:'Ativar fontes integradas',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('h2')).some(node=>node.textContent==='Extensões')||document.querySelector('[role="alert"]'),{},{timeout:100_000});
  if(await page.getByRole('alert').count())throw new Error(await page.getByRole('alert').innerText());
  const current=await page.getByLabel('Endereço do servidor',{exact:true}).inputValue();
  await page.waitForFunction(async()=>{const value=await window.__TAURI_INTERNALS__.invoke('get_settings');return value.integratedEngine===true&&typeof value.onlineSource==='string';});
  const preferences=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('get_settings'));
  assert.equal(preferences.integratedEngine,true);
  assert.equal(preferences.onlineSource,await page.getByLabel('Fonte',{exact:true}).inputValue());
  if(server)assert.equal(current,server);else server=current;
  const denied=await fetch(`${server}api/graphql`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'{aboutServer{name}}'})});assert.equal(denied.status,401);
  await page.getByRole('button',{name:'Carregar extensões',exact:true}).click();
  await page.getByText('Nenhum repositório adicionado.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('alert').count(),0);
  return page;
}
try{
  let page=await open();
  const verificationError=await page.evaluate(async server=>{try{await window.__TAURI_INTERNALS__.invoke('open_source_browser',{server,source:'0'});return '';}catch(error){return String(error);}},server);
  assert.ok(verificationError.includes('não possui site para verificação'),verificationError);
  console.log('PASS: verification command queries the real source API and reports the local source without a website');
  console.log('PASS: native integrated start and protected extension catalog');
  const first=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('start_integrated_engine'));assert.equal(first.server,server);
  execFileSync('taskkill',['/PID',String(app.pid),'/F'],{windowsHide:true,stdio:'ignore'});
  await browser.close();browser=null;await waitClosed();
  console.log('PASS: forced app exit also stops its engine');
  page=await open();
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})).catch(error=>{
    if(!String(error).includes('Target page, context or browser has been closed'))throw error;
  });
  await browser.close();browser=null;await waitClosed();
  console.log('PASS: real bundled engine starts through Yomi, authenticates, lists extensions, reuses process, dies with forced app exit and restarts on same port; normal exit stops it');
  successful=true;
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(app&&app.exitCode===null){try{execFileSync('taskkill',['/PID',String(app.pid),'/F'],{windowsHide:true,stdio:'ignore'});}catch{}}
  if(successful){await new Promise(r=>setTimeout(r,500));await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:300});}
  else console.error(`Diagnostic data preserved: ${root}`);
}
