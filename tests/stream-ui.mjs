import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.route('**/stream-test.png',async route=>route.fulfill({contentType:'image/png',body:await readFile('node_modules/playwright-core/lib/server/chromium/appIcon.png')}));
 await page.addInitScript(()=>{
  window.isTauri=true;window.__pageRequests=[];window.__starts=0;
  const book={id:'stream-test',title:'Leitura progressiva',series:'Teste',chapter:'1',format:'stream',source:'test',cover:'/stream-test.png',pageCount:3,page:0,completed:false,favorite:false,addedAt:1,lastRead:null};
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,convertFileSrc:()=>'/stream-test.png',invoke:async(cmd,args)=>{
   if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return JSON.parse(localStorage.getItem('prefs')??'{"guardian":false,"mode":"single"}');
   if(cmd==='save_settings'){localStorage.setItem('prefs',JSON.stringify(args.value));return;}
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if(cmd==='list_site_readings')return [];if(cmd==='set_site_layout')return;
   if(cmd==='list_books')return [];if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
   if(cmd==='start_integrated_engine'){window.__starts++;return {server:'http://127.0.0.1:4568/',name:'Suwayomi',version:'test',authenticated:true,sources:[{id:'0',name:'Local',lang:'all'},{id:'99',name:'Fonte lembrada',lang:'pt'}]};}
   if(cmd==='suwayomi_search')return {hasNextPage:false,mangas:[{id:42,title:'Teste'}]};
   if(cmd==='suwayomi_cover')return '/stream-test.png';
   if(cmd==='suwayomi_chapters')return {manga:{id:42,title:'Teste'},chapters:[{id:8,name:'Capítulo 1',chapterNumber:1}]};
   if(cmd==='open_online_chapter')return book;
   if(cmd==='open_book')return {book,pages:['0.pending','1.pending','2.pending'],bookmarks:[]};
   if(cmd==='online_page'){window.__pageRequests.push(args.index);return '/stream-test.png';}
   if(cmd==='save_progress')return;
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Fontes online',exact:true}).click();
 await page.getByRole('button',{name:'Ativar fontes integradas',exact:true}).click();
 await page.getByLabel('Fonte',{exact:true}).selectOption('99');
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('button',{name:/Ver capítulos de Teste/}).click();
 await page.getByRole('button',{name:'Ler online',exact:true}).click();
 await page.getByAltText('Página 1',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__pageRequests),[0]);
 await page.getByRole('button',{name:'Próxima página',exact:true}).click();
 await page.getByAltText('Página 2',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__pageRequests),[0,1]);
 await page.reload();
 await page.getByRole('button',{name:'Fontes online',exact:true}).click();
 await page.getByLabel('Fonte',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Fonte',{exact:true}).inputValue(),'99');
 assert.equal(await page.evaluate(()=>window.__starts),1);
 console.log('PASS: online page loads on demand; source selection and integrated activation restored after reload (mocked transport)');
}finally{await browser.close();}
