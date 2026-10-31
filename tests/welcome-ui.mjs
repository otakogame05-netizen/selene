import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:1425');
 await page.getByRole('heading',{name:'Boas-vindas ao seu universo de histórias.'}).waitFor();
 await page.waitForTimeout(700);
 assert.equal(await page.locator('.welcome-moon img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 await mkdir('.test-results/welcome',{recursive:true});await page.screenshot({path:'.test-results/welcome/opening.png'});
 await page.waitForTimeout(3000);
 assert.equal(await page.getByRole('main',{name:'Boas-vindas ao Selene'}).isVisible(),true,'Opening must remain visible long enough to read');
 await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).waitFor();
 assert.equal(await page.getByRole('main',{name:'Boas-vindas ao Selene'}).count(),0);
 await page.reload();await page.getByRole('button',{name:'Entrar no catálogo'}).click();
 await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).waitFor();
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
 await page.getByRole('button',{name:'Catálogos das fontes',exact:true}).waitFor({timeout:2000});
 assert.deepEqual(errors,[]);
 console.log('PASS: welcome illustration loads, automatic entry, skip button and reduced motion');
}finally{await browser.close();}
