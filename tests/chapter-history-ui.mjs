import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const initial=[{id:'r1',title:'Obra de aventura',chapter:'Capítulo 10',cover:'',url:'https://source.test/obra/10',lastRead:Date.now()},{id:'r2',title:'Obra de aventura',chapter:'Capítulo 11',cover:'',url:'https://source.test/obra/11',lastRead:Date.now()-1000}];
  window.isTauri=true;window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,convertFileSrc:()=>document.querySelector('link[rel="icon"]').href,invoke:async(cmd,args)=>{
   if(cmd==='reader_fullscreen'){if(args.enabled!==null)window.__readerFull=args.enabled;return window.__readerFull??false;}if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return JSON.parse(localStorage.getItem('settings')??'{"integratedEngine":true,"onlineSource":"99","guardian":false}');
   if(cmd==='save_settings'){localStorage.setItem('settings',JSON.stringify(args.value));return;}
   if(cmd==='list_books')return [{id:'local',title:'Volume local',series:'',chapter:'',source:'local',format:'folder',cover:'fixture-cover',pageCount:10,page:2,completed:false,favorite:false,addedAt:1000,lastRead:2000}];
   if(cmd==='list_site_readings')return JSON.parse(localStorage.getItem('history')??JSON.stringify(initial));
   if(cmd==='remove_site_reading'){const rows=JSON.parse(localStorage.getItem('history')??JSON.stringify(initial));localStorage.setItem('history',JSON.stringify(rows.filter(row=>row.id!==args.id)));return;}
   if(cmd==='list_online_favorites')return [];
   if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
   if(cmd==='start_integrated_engine')return {server:'http://127.0.0.1:4568/',name:'Fixture',version:'1',authenticated:true,sources:[{id:'99',name:'ToonLivre',lang:'pt-BR'}]};
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};
   if(cmd==='suwayomi_cover')return 'fixture-cover';
   if(cmd==='suwayomi_search')return {hasNextPage:false,mangas:[{id:42,title:'Obra de teste'}]};
   if(cmd==='suwayomi_chapters')return {manga:{id:42,title:'Obra de teste',description:'Uma aventura sob a lua. '+ 'Uma história para explorar. '.repeat(20)},chapters:[{id:1,name:'Capítulo 00',chapterNumber:0},{id:2,name:'Capítulo 01',chapterNumber:1},{id:3,name:'Capítulo 10',chapterNumber:10},{id:4,name:'Capítulo 10.5',chapterNumber:10.5},{id:5,name:'Capítulo 100',chapterNumber:100}]};
   if(cmd==='close_source_site'||cmd==='set_site_layout')return;
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Ver capítulos de Obra de teste',exact:true}).click();
 await page.getByRole('heading',{name:'Sinopse',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ler sinopse completa',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Mostrar menos',exact:true}).getAttribute('aria-expanded'),'true');
 await page.getByAltText('Capa de Obra de teste',{exact:true}).waitFor();
 assert.equal(await page.getByAltText('Capa de Obra de teste',{exact:true}).evaluate(img=>img.complete&&img.naturalWidth>0),true);
 const names=()=>page.locator('.chapter-label span').allTextContents();
 await page.getByLabel('Ordem dos capítulos',{exact:true}).selectOption('desc');assert.equal((await names())[0],'Capítulo 100');
 await page.getByLabel('Número do capítulo',{exact:true}).fill('010');assert.deepEqual(await names(),['Capítulo 10']);
 await page.getByRole('button',{name:'Selecionar até 50',exact:true}).click();assert.equal(await page.locator('.chapter-list input:checked').count(),1);
 await page.getByLabel('Número do capítulo',{exact:true}).fill('10,5');assert.deepEqual(await names(),['Capítulo 10.5']);assert.equal(await page.locator('.chapter-list input:checked').count(),0);
 await page.getByLabel('Número do capítulo',{exact:true}).fill('999');await page.getByText('Nenhum capítulo encontrado para essa busca.',{exact:true}).waitFor();
 await page.getByLabel('Número do capítulo',{exact:true}).fill('');assert.equal((await names())[0],'Capítulo 100');
 await mkdir('.test-results/chapter-history',{recursive:true});await page.screenshot({path:'.test-results/chapter-history/chapters.png'});
 await page.getByRole('button',{name:'Lidos recentemente',exact:true}).click();
 const online=await page.locator('.recent-site-readings .cover-wrap').first().boundingBox(),local=await page.locator('.library-content > .book-grid .cover-wrap').first().boundingBox();
 assert.ok(Math.abs(online.width-local.width)<2&&Math.abs(online.height-local.height)<2,'History cards must use the same cover geometry as local readings');
 await page.screenshot({path:'.test-results/chapter-history/history.png'});
 await page.getByRole('button',{name:'Apagar do histórico Obra de aventura · Capítulo 10',exact:true}).click();
 await page.getByRole('button',{name:'Reabrir Obra de aventura · Capítulo 10',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Reabrir Obra de aventura · Capítulo 11',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Volume local',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Lidos recentemente',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Reabrir Obra de aventura · Capítulo 10',exact:true}).count(),0);
 await page.getByRole('button',{name:'Reabrir Obra de aventura · Capítulo 11',exact:true}).waitFor();
 await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await page.getByRole('button',{name:'Ver capítulos de Obra de teste',exact:true}).click();
 assert.equal(await page.getByLabel('Ordem dos capítulos',{exact:true}).inputValue(),'desc');
 await page.setViewportSize({width:720,height:900});await page.screenshot({path:'.test-results/chapter-history/compact.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: exact numeric chapter search, descending order persisted, visible-only selection, no matches, history cover layout and removal of only the selected record (mocked native bridge)');
}finally{await browser.close();}
