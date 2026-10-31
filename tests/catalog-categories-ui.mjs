import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:820}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.isTauri=true;window.__searches=[];window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,invoke:async(cmd,args)=>{
   if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return JSON.parse(localStorage.getItem('settings')??'{"integratedEngine":true,"onlineSource":"99","guardian":false}');
   if(cmd==='save_settings'){localStorage.setItem('settings',JSON.stringify(args.value));return;}
   if(['list_books','list_site_readings','list_online_favorites'].includes(cmd))return [];
   if(cmd==='close_source_site'||cmd==='set_site_layout')return;
   if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
   if(cmd==='start_integrated_engine')return {server:'http://127.0.0.1:4568/',name:'Fixture',version:'1',authenticated:true,sources:[{id:'99',name:'Fonte com gêneros',lang:'pt-BR'},{id:'100',name:'ToonLivre',lang:'pt-BR'},{id:'101',name:'Fonte sem atualizações',lang:'en'}]};
   if(cmd==='suwayomi_cover')throw 'Sem capa';
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:args.source!=='101',supportsNewest:args.source!=='101',filterPopular:true,filterLatest:true,filterNewest:true,genres:args.source==='99'?[{id:'genre-action',name:'Ação'},{id:'genre-fantasy',name:'Fantasia'}]:[]};
   if(cmd==='suwayomi_search'){window.__searches.push(args);return {hasNextPage:true,mangas:[{id:42,title:`${args.kind}|${args.genre||'todos'}|${args.page}|${args.query}`} ]};}
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Ver capítulos de popular|todos|1|',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Populares',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Atualizados',exact:true}).click();
 await page.getByRole('button',{name:'Ver capítulos de latest|todos|1|',exact:true}).waitFor();
 await page.getByLabel('Conteúdo de Atualizados',{exact:true}).selectOption('newest');
 await page.getByRole('button',{name:'Ver capítulos de newest|todos|1|',exact:true}).waitFor();
 await page.getByRole('button',{name:'Filtro',exact:true}).click();
 await page.getByLabel('Gênero',{exact:true}).selectOption('genre-fantasy');
 await page.getByRole('button',{name:'Ver capítulos de newest|genre-fantasy|1|',exact:true}).waitFor();
 await page.getByRole('button',{name:'Próxima',exact:true}).click();
 await page.getByRole('button',{name:'Ver capítulos de newest|genre-fantasy|2|',exact:true}).waitFor();
 await page.getByLabel('Nome do mangá',{exact:true}).fill('Arqueiro');
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('button',{name:'Ver capítulos de newest|genre-fantasy|1|Arqueiro',exact:true}).waitFor();
 const last=await page.evaluate(()=>window.__searches.at(-1));assert.equal(last.genre,'genre-fantasy');assert.equal(last.kind,'newest');assert.equal(last.page,1);
 await mkdir('.test-results/catalog-categories',{recursive:true});await page.screenshot({path:'.test-results/catalog-categories/genres.png'});
 await page.getByLabel('Fonte',{exact:true}).selectOption('100');
 await page.getByRole('button',{name:'Ver capítulos de popular|todos|1|Arqueiro',exact:true}).waitFor();
 await page.getByText('Esta fonte não oferece filtro de gênero pela extensão.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Atualizados',exact:true}).click();
 await page.getByRole('button',{name:'Ver capítulos de latest|todos|1|',exact:true}).waitFor();
 await page.getByLabel('Conteúdo de Atualizados',{exact:true}).selectOption('newest');
 await page.getByRole('button',{name:'Ver capítulos de newest|todos|1|',exact:true}).waitFor();
 await page.getByLabel('Fonte',{exact:true}).selectOption('101');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(node=>node.textContent==='Atualizados')?.disabled);
 await page.setViewportSize({width:720,height:900});await page.screenshot({path:'.test-results/catalog-categories/compact.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: real category/genre arguments, latest vs newest, server-side genre selection, pagination/search preservation, source reset and unsupported-source messages (mocked native bridge)');
}finally{await browser.close();}
