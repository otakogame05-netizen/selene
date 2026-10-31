import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1330,height:720}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.isTauri=true;window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,invoke:async(cmd,args)=>{
   if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return JSON.parse(localStorage.getItem('settings')??'{"guardian":false,"integratedEngine":true,"onlineSource":"99"}');
   if(cmd==='save_settings'){localStorage.setItem('settings',JSON.stringify(args.value));return;}
   if(cmd==='list_books'||cmd==='list_site_readings')return [];
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return JSON.parse(localStorage.getItem('favorites')??'[]');
   if(cmd==='set_online_favorite'){
    const saved=JSON.parse(localStorage.getItem('favorites')??'[]');const key=v=>`${v.server}|${v.sourceId}|${v.mangaId}`;const rows=saved.filter(v=>key(v)!==key(args.input));
    if(args.enabled)rows.push({...args.input,id:'favorite1',cover:'',integrated:true});localStorage.setItem('favorites',JSON.stringify(rows));return;
   }
   if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
   if(cmd==='start_integrated_engine')return {server:'http://127.0.0.1:4568/',name:'Fixture',version:'1',authenticated:true,sources:[{id:'99',name:'ToonLivre',lang:'pt-BR'},...Array.from({length:60},(_,i)=>({id:String(100+i),name:'MangaDex',lang:`idioma-${i}`}))]};
   if(cmd==='suwayomi_cover')throw 'Sem capa na fixture';
   if(cmd==='suwayomi_search')return {hasNextPage:false,mangas:[{id:42,title:'Obra online'},{id:43,title:'Outra obra'}]};
   if(cmd==='suwayomi_chapters')return {manga:{id:42,title:'Obra online'},chapters:[{id:8,name:'Capítulo 65',chapterNumber:65}]};
   if(cmd==='close_source_site'||cmd==='set_site_layout')return;
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Ver capítulos de Obra online',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('Fonte',{exact:true}).locator('option').count(),61);
 assert.equal(await page.locator('.catalog-sources').count(),0);
 assert.equal(await page.locator('.source-actions').getAttribute('open'),null);
 const grid=await page.locator('.online-grid').boundingBox();assert.ok(grid.y<430,`Catalog starts too low: ${grid.y}`);
 await mkdir('.test-results/catalog-favorites',{recursive:true});await page.screenshot({path:'.test-results/catalog-favorites/desktop.png'});
 await page.getByRole('button',{name:'Favoritar Obra online',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos Obra online',exact:true}).waitFor();
 await page.getByRole('button',{name:'Favoritos',exact:true}).click();
 await page.getByRole('region',{name:'Mangás favoritos das fontes'}).waitFor();
 await page.getByText('ToonLivre · pt-BR',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Ver capítulos de Obra online',exact:true}).click();
 await page.getByRole('heading',{name:'Obra online',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ler online',exact:true}).waitFor();
 await page.getByRole('button',{name:'Remover dos favoritos Obra online',exact:true}).click();
 await page.getByRole('button',{name:'Favoritar Obra online',exact:true}).waitFor();
 await page.getByRole('button',{name:'Favoritar Obra online',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos Obra online',exact:true}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:'Remover dos favoritos Obra online',exact:true}).waitFor();
 await page.getByRole('button',{name:'Favoritos',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos Obra online',exact:true}).click();
 await page.getByRole('region',{name:'Mangás favoritos das fontes'}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Biblioteca',exact:true}).click();
 await page.getByRole('button',{name:'Ver capítulos de Obra online',exact:true}).waitFor();
 await page.setViewportSize({width:720,height:900});await page.screenshot({path:'.test-results/catalog-favorites/compact.png'});
 assert.ok((await page.locator('.online-grid').boundingBox()).y<520);
 await page.getByRole('button',{name:'Meus mangás',exact:true}).click();
 await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: compact catalog with 61 sources, catalog startup, local secondary tab, favorite/unfavorite, source retained, reopen chapters and persisted favorite after reload (mocked native bridge)');
}finally{await browser.close();}
