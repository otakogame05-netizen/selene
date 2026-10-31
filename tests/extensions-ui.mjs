import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.YOMI_BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.isTauri=true;window.__extensionCalls=[];let installed=false;let store=false;
    const entry=()=>({pkgName:'test.source',name:'Fonte de teste',lang:'pt',versionName:'1.0',isInstalled:installed,hasUpdate:false,isObsolete:false});
    const connection=()=>({server:'http://127.0.0.1:4568/',name:'Suwayomi',version:'test',authenticated:true,sources:installed?[{id:'1',name:'Fonte de teste',lang:'pt'}]:[]});
    window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,invoke:async(cmd,args)=>{
      if(cmd.startsWith('plugin:'))return 1;
      if(cmd==='get_settings')return {guardian:false};if(cmd==='save_settings')return;
      if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if(cmd==='list_site_readings')return [];if(cmd==='set_site_layout')return;
   if(cmd==='list_books')return [];if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
      if(cmd==='start_integrated_engine'||cmd==='suwayomi_connect')return connection();
      if(cmd==='extension_catalog')return {extensions:store?[entry()]:[],stores:store?[{name:'Repositório de teste',indexUrl:'https://example.test/index.min.json'}]:[]};
      if(cmd==='extension_store'){window.__extensionCalls.push(args);store=!args.remove;return;}
      if(cmd==='extension_change'){window.__extensionCalls.push(args);if(window.__failExtension)throw 'Instalação recusada pelo motor';installed=args.action!=='uninstall';return;}
      throw new Error(`Unexpected ${cmd}`);
    }};
  });
  await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
  await page.getByRole('button',{name:'Fontes online',exact:true}).click();
  await page.getByRole('button',{name:'Ativar fontes integradas',exact:true}).click();
  await page.getByRole('heading',{name:'Extensões',exact:true}).waitFor();
  await page.getByRole('button',{name:'Carregar extensões',exact:true}).click();
  await page.getByText('Nenhum repositório adicionado.',{exact:false}).waitFor();
  await page.getByLabel('Índice do repositório',{exact:true}).fill('https://example.test/index.min.json');
  await page.getByRole('button',{name:'Adicionar repositório',exact:true}).click();
  await page.getByText('Fonte de teste',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Instalar extensão',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal((await page.evaluate(()=>window.__extensionCalls)).length,1);
  await page.getByRole('button',{name:'Instalar extensão',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar extensão',exact:true}).click();
  await page.getByRole('button',{name:'Desinstalar',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Fonte',{exact:true}).inputValue(),'1');
  await page.getByRole('button',{name:'Desinstalar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar extensão',exact:true}).click();
  await page.getByRole('button',{name:'Instalar extensão',exact:true}).waitFor();
  await page.evaluate(()=>{window.__failExtension=true;});
  await page.getByRole('button',{name:'Instalar extensão',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar extensão',exact:true}).click();
  await page.getByRole('alert').getByText('Instalação recusada pelo motor').waitFor();
  assert.equal(await page.getByRole('button',{name:'Desinstalar',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: integrated start, repository, install confirmation/cancel, source reload, uninstall and failure (mocked transport)');
}finally{await browser.close();}
