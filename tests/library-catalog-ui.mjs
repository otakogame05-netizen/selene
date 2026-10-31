import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.isTauri=true;window.__searches=[];
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>1,invoke:async(cmd,args)=>{
   if(cmd.startsWith('plugin:'))return 1;
   if(cmd==='get_settings')return JSON.parse(localStorage.getItem('settings')??'{"integratedEngine":true,"onlineSource":"99","guardian":false}');
   if(cmd==='save_settings'){localStorage.setItem('settings',JSON.stringify(args.value));return;}
   if(cmd==='suwayomi_catalog_options')return {supportsLatest:true,supportsNewest:true,filterPopular:true,filterLatest:true,filterNewest:true,genres:[]};if(cmd==='list_online_favorites')return [];if(cmd==='list_site_readings')return [];if(cmd==='set_site_layout')return;
   if(cmd==='list_books')return [];if(cmd==='get_saved_queue')return {revision:0,queue:null};if(cmd==='suwayomi_session')return true;
   if(cmd==='start_integrated_engine')return {server:'http://127.0.0.1:4568/',name:'Test',version:'1',authenticated:true,sources:[{id:'99',name:'Fonte A',lang:'pt'},{id:'100',name:'ToonLivre',lang:'en'},{id:'101',name:'Fonte com falha',lang:'pt'}]};
   if(cmd==='suwayomi_cover')throw 'Sem capa';
   if(cmd==='suwayomi_search'){window.__searches.push(args);if(args.source==='101')throw 'Fonte temporariamente indisponível';return {hasNextPage:args.page===1,mangas:[{id:42,title:`${args.source} · ${args.query||'Populares'} · ${args.page}`}]};}
   if(cmd==='suwayomi_chapters')return {manga:{id:42,title:'Mangá selecionado'},chapters:[{id:8,name:'Capítulo 1',chapterNumber:1}]};
   if(cmd==='close_source_site')return;
   if(cmd==='open_source_site'){window.__readSite=args;return;}
   if(cmd==='open_source_browser'){window.__verifiedSource=args;return;}
   throw new Error(cmd);
  }};
 });
 await page.goto(process.env.YOMI_TEST_URL??'http://127.0.0.1:1425');
 await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).click();
 await page.getByRole('button',{name:/^Ver capítulos de 99 · Populares · 1/}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Extensões',exact:true}).count(),0);
 assert.equal(await page.getByLabel('Fonte',{exact:true}).locator('option').count(),3);
 await page.getByText('Ações da fonte',{exact:true}).click();
 await page.getByRole('button',{name:'Verificar acesso à fonte',exact:true}).click();
 await page.getByText('Conclua a verificação na janela aberta, feche-a e tente novamente.',{exact:false}).waitFor();
 assert.equal((await page.evaluate(()=>window.__verifiedSource)).source,'99');
 await page.getByRole('button',{name:'Próxima',exact:true}).click();
 await page.getByRole('button',{name:/^Ver capítulos de 99 · Populares · 2/}).waitFor();
 await page.getByLabel('Nome do mangá',{exact:true}).fill('Meu título');
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('button',{name:/^Ver capítulos de 99 · Meu título · 1/}).waitFor();
 await page.getByLabel('Fonte',{exact:true}).selectOption('100');
 await page.getByRole('button',{name:/^Ver capítulos de 100 · Meu título · 1/}).waitFor();
 const last=await page.evaluate(()=>window.__searches.at(-1));assert.equal(last.page,1);assert.equal(last.source,'100');assert.equal(last.query,'Meu título');
 await page.getByRole('button',{name:/^Ver capítulos de 100 · Meu título · 1/}).click();
 await page.getByRole('button',{name:'Ler online',exact:true}).click();
 await page.getByRole('region',{name:'Leitura integrada da fonte'}).waitFor();
 assert.equal((await page.evaluate(()=>window.__readSite)).chapterId,8);
 await page.getByRole('button',{name:'← Voltar ao catálogo',exact:true}).click();
 await page.getByRole('heading',{name:'Mangá selecionado',exact:true}).waitFor();
 await page.getByRole('button',{name:'Ler no site',exact:true}).click();
 const site=await page.evaluate(()=>window.__readSite);assert.equal(site.chapterId,8);assert.equal(site.source,'100');
 await page.getByRole('button',{name:'← Voltar ao catálogo',exact:true}).click();
 assert.equal(await page.getByRole('region',{name:'Leitura integrada da fonte'}).count(),0);
 await page.getByRole('button',{name:'Verificar acesso a Capítulo 1',exact:true}).click();
 await page.getByText('A verificação abriu na página deste capítulo.',{exact:false}).waitFor();
 const verified=await page.evaluate(()=>window.__verifiedSource);assert.equal(verified.chapterId,8);assert.equal(verified.source,'100');
 await page.getByRole('button',{name:'Meus mangás',exact:true}).click();
 await page.getByRole('heading',{name:/Sua biblioteca/}).waitFor();
 await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).click();
 await page.getByRole('button',{name:/^Ver capítulos de 100 · Populares · 1/}).waitFor();
 await page.getByLabel('Fonte',{exact:true}).selectOption('101');
 await page.getByRole('alert').getByText('Fonte temporariamente indisponível').waitFor();
 const failed=await page.evaluate(()=>window.__searches.filter(item=>item.source==='101').length);
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__searches.filter(item=>item.source==='101').length),failed);
 assert.deepEqual(errors,[]);
 console.log('PASS: library catalogs, automatic popular list, compact source selector, query across sources, pagination reset, chapters, saved source and failed source without retry loop (mocked transport)');
}finally{await browser.close();}
