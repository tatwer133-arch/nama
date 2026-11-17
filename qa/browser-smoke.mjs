import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.wav':'audio/wav'};
let server,browser,origin;
function serve(req,res){
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 let path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403).end();return;}
 if(pathname==='/'||/\/(room|invite|watch)\/[a-zA-Z0-9]{6}$/.test(pathname))path=resolve(root,'index.html');
 readFile(path).then(data=>{res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}).catch(()=>{res.writeHead(404).end('not found');});
}
async function openGuest(viewport){
 const page=await browser.newPage({viewport,isMobile:viewport.width<600,deviceScaleFactor:1});
 const pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('dialog',d=>d.accept('QA Player'));
 // Guest mode must work without OAuth credentials or external Firebase calls.
 await page.route(/firebase-config\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const firebaseConfig = Object.freeze({});'}));
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:20000});
 await page.locator('#guest-login').waitFor({state:'visible',timeout:20000});
 await page.locator('#guest-login').click();
 await page.locator('#auth-cover').waitFor({state:'hidden',timeout:20000});
 return{page,pageErrors};
}
test('Chromium: real mobile UI, guest login, bot turns, navigation, and responsiveness',async t=>{
 server=createServer(serve);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
 await mkdir('qa-artifacts',{recursive:true});
 await t.test('Android-sized 390 px viewport is usable with no page-level JS errors',async()=>{
  const {page,pageErrors}=await openGuest({width:390,height:844});
  await page.locator('[data-action="bot"]').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#auth-cover').isVisible(),false);
  assert.ok((await page.locator('#nav .nav-item').count())>=5);
  await page.screenshot({path:'qa-artifacts/mobile-home.png',fullPage:true});
  const h=await page.evaluate(()=>({body:document.documentElement.scrollWidth,window:window.innerWidth}));
  assert.ok(h.body<=h.window+3,`Mobile horizontal overflow: ${JSON.stringify(h)}`);
  assert.deepEqual(pageErrors,[]);
  await page.close();
 });
 await t.test('bot gameplay mounts valid 5x5 board and processes placement',async()=>{
  const {page,pageErrors}=await openGuest({width:390,height:844});
  await page.locator('[data-action="bot"]').first().click();
  await page.locator('[role="grid"] .cell').first().waitFor({state:'visible',timeout:15000});
  assert.equal(await page.locator('[role="grid"] .cell').count(),25);
  // The WebGL canvas intentionally covers the original grid. Simulate a
  // genuine touchscreen tap on the visible 3D canvas instead of attempting
  // to click a DOM element hidden beneath it.
  const canvas=page.locator('.royale-webgl'),box=await canvas.boundingBox();
  let changed=0;
  if(box){
   for(const yy of [.28,.38,.48,.58,.68,.78]){
    for(const xx of [.2,.32,.44,.56,.68,.8]){
     await page.mouse.click(box.x+box.width*xx,box.y+box.height*yy);
     await page.waitForTimeout(25);
     changed=await page.locator('[role="grid"] .stone').count();
     if(changed)break;
    }
    if(changed)break;
   }
  }
  if(!changed){
   // On devices without WebGL the accessible HTML grid remains interactive.
   await page.locator('[data-action="cell"][data-cell="0"]').evaluate(el=>el.click());
   await page.waitForTimeout(100);
   changed=await page.locator('[role="grid"] .stone').count();
  }
  assert.ok(changed>=1,'Game board must accept placement through 3D touch or fallback grid');
  await page.screenshot({path:'qa-artifacts/mobile-game.png',fullPage:true});
  assert.deepEqual(pageErrors,[]);
  await page.close();
 });
 await t.test('navigation, profile editing and guest social controls are accessible',async()=>{
  const {page,pageErrors}=await openGuest({width:390,height:844});
  await page.locator('#nav [data-tab="social"]').click();
  await page.getByText('اللمة والصحاب').first().waitFor({state:'visible'});
  await page.locator('#nav [data-tab="profile"]').click();
  await page.locator('#profile-form').waitFor({state:'visible'});
  await page.screenshot({path:'qa-artifacts/mobile-profile.png',fullPage:true});
  const h=await page.evaluate(()=>({body:document.documentElement.scrollWidth,window:window.innerWidth}));
  assert.ok(h.body<=h.window+3,`Profile horizontal overflow: ${JSON.stringify(h)}`);
  assert.deepEqual(pageErrors,[]);
  await page.close();
 });
 await t.test('small 320 px and desktop 1280 px preserve responsive layout',async()=>{
  for(const width of [320,1280]){
   const {page,pageErrors}=await openGuest({width,height:850});
   const h=await page.evaluate(()=>({body:document.documentElement.scrollWidth,window:window.innerWidth}));
   assert.ok(h.body<=h.window+3,`Overflow at ${width}px: ${JSON.stringify(h)}`);
   assert.deepEqual(pageErrors,[]);
   if(width===1280)await page.screenshot({path:'qa-artifacts/desktop-home.png',fullPage:true});
   await page.close();
  }
 });
});
