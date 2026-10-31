import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><title>Yomi verificação local</title><style>html,body{background:white;color:black}</style><h1>Teste de navegação manual</h1><p>Sem desafio ou site externo.</p>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=new URL(process.env.YOMI_SOURCE_BROWSER_URL);url.hash=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}});
 await page.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('close',e=>console.info('YOMI_WS_CLOSE',e.code,e.reason));}};});
 page.on('console',message=>{if(message.text().startsWith('YOMI_WS_CLOSE'))console.log(message.text());});
 page.on('websocket',socket=>{let count=0;socket.on('framesent',event=>{if(count++<6){try{console.log('Viewer sent:',JSON.parse(String(event.payload)).type);}catch{}}});});
 page.on('websocket',socket=>{socket.on('socketerror',error=>console.error('Verification socket:',error));socket.on('close',()=>console.log('Verification socket closed'));let count=0;socket.on('framereceived',event=>{if(count++<8){try{console.log('Verification event:',JSON.parse(String(event.payload)).type);}catch{console.log('Verification control frame');}}});});
 page.on('pageerror',error=>console.error('Viewer script:',error.message));
 await page.goto(url.href);
 try{await page.waitForFunction(()=>document.querySelector('#title')?.textContent.includes('Yomi verificação local'),{},{timeout:120_000});}
 catch(error){console.error('Browser diagnostic:',await page.locator('body').innerText());throw error;}
 await page.waitForFunction(()=>{const canvas=document.querySelector('canvas');if(!canvas?.width||!canvas?.height)return false;const data=canvas.getContext('2d').getImageData(0,0,Math.min(256,canvas.width),Math.min(128,canvas.height)).data;return data.some((value,index)=>index%4===3&&value>0);});
 assert.equal(await page.locator('#url').inputValue(),url.hash.slice(1));
 console.log('PASS: official browser HTML and authenticated WebSocket relay load and render a controlled local page; no external challenge was automated');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await browser.close();}
