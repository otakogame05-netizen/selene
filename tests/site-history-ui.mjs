import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.isTauri=true;window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,invoke:async(cmd,args)=>{
   if(cmd==='reader_fullscreen'){if(args.enabled!==null)window.__readerFull=args.enabled;return window.__readerFull??false;}if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return {guardian:false};
   if(cmd==='list_books')return [];
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if(cmd==='list_site_readings')return [{id:'reading1',title:'Obra online',chapter:'Capítulo 65',url:'https://source.test/obra/65',cover:'',lastRead:Date.now()}];
   if(cmd==='resume_site_reading'){window.__resumed=args.id;return;}
   if(cmd==='set_site_layout'){window.__layout=args;return;}
   if(cmd==='close_source_site')return;
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Lidos recentemente',exact:true}).click();
 for(const width of [720,1366,1920,3840]){
  await page.setViewportSize({width,height:Math.min(2160,Math.round(width*9/16))});
  await page.getByRole('button',{name:'Reabrir Obra online · Capítulo 65',exact:true}).click();
  const back=page.getByRole('button',{name:'← Voltar às leituras recentes',exact:true});await back.waitFor();
  for(const item of [back,page.getByLabel('Largura da leitura'),page.getByRole('group',{name:'Zoom da leitura'})]){
   const box=await item.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=72,JSON.stringify({width,box}));
  }
  assert.equal(await page.evaluate(()=>window.__resumed),'reading1');
  await back.click();
 }
 await page.getByRole('button',{name:'Reabrir Obra online · Capítulo 65',exact:true}).click();
 await page.getByLabel('Largura da leitura').selectOption('screen');
 await page.getByRole('button',{name:'Aumentar zoom da leitura',exact:true}).click();
 await page.waitForFunction(()=>window.__layout?.zoom===110&&window.__layout?.comfortable===false);
 await page.getByRole('button',{name:'← Voltar às leituras recentes',exact:true}).click();
 await page.getByRole('button',{name:'Reabrir Obra online · Capítulo 65',exact:true}).click();
 assert.equal(await page.getByLabel('Largura da leitura').inputValue(),'screen');
 await page.getByRole('group',{name:'Zoom da leitura'}).getByText('110%',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Tela cheia',exact:true}).click();
 await page.getByRole('button',{name:'Sair da tela cheia',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ocultar barras da leitura online',exact:true}).click();
 await page.waitForFunction(()=>window.__layout.hidden===true);
 assert.equal(await page.locator('.site-reader-bar').count(),0);
 await page.getByRole('button',{name:'Mostrar controles da leitura online',exact:true}).click();
 await page.waitForFunction(()=>window.__layout.hidden===false);
 await page.getByRole('button',{name:'← Voltar às leituras recentes',exact:true}).click();
 await page.waitForFunction(()=>window.__readerFull===false);
 console.log('PASS: recent online chapter, reopen, persistent width/zoom and toolbar at 720, 1366, 1920 and 3840px (mocked native bridge)');
}finally{await browser.close();}
