import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
test('server: email auth, rooms, virtual wallet, static shell', {timeout:25000},async()=>{
 const port=await freePort(),tmp=mkdtempSync(path.join(tmpdir(),'seega-e2e-'));
 const processServer=spawn(process.execPath,['server.js'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:tmp,SESSION_SECRET:'integration-test-only-secret',BASE_URL:`http://localhost:${port}`},stdio:['ignore','pipe','pipe']});
 let logs='';processServer.stderr.on('data',x=>logs+=x);
 const base=`http://127.0.0.1:${port}`;async function api(url,body,cookie){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try{
  let ok=false;for(let i=0;i<80;i++){try{const r=await api('/health');if(r.status===200){ok=true;break;}}catch{}await delay(80);}assert.ok(ok,'server did not start: '+logs);
  const app=await api('/');assert.equal(app.status,200);assert.match(app.data,/سيجا رويال/);
  const a=await api('/api/auth/register',{name:'مريم',email:'mary@example.com',password:'secure-password-123'});assert.equal(a.status,200);assert.ok(a.cookie);
  const b=await api('/api/auth/register',{name:'محمد',email:'moh@example.com',password:'secure-password-234'});assert.equal(b.status,200);
  const repeat=await api('/api/auth/register',{name:'X',email:'mary@example.com',password:'another-pass'});assert.equal(repeat.status,409);
  const incorrect=await api('/api/auth/login',{email:'mary@example.com',password:'wrong-password'});assert.equal(incorrect.status,401);
  const login=await api('/api/auth/login',{email:'mary@example.com',password:'secure-password-123'});assert.equal(login.status,200);
  const me=await api('/api/me',null,a.cookie);assert.equal(me.data.user.name,'مريم');
  const room=await api('/api/rooms',{kind:'private'},a.cookie);assert.equal(room.status,200);const id=room.data.room.id;
  const joined=await api(`/api/rooms/${id}/join`,{},b.cookie);assert.equal(joined.data.room.status,'playing');assert.equal(joined.data.room.players.length,2);
  const intruder=await api(`/api/rooms/${id}`,null,null);assert.equal(intruder.status,401);
  const daily=await api('/api/daily',{},a.cookie);assert.equal(daily.data.user.coins,2950);assert.equal(daily.data.user.gems,85);
  const dailyAgain=await api('/api/daily',{},a.cookie);assert.equal(dailyAgain.status,409);
  const bought=await api('/api/store/buy',{id:'gold'},a.cookie);assert.equal(bought.data.user.coins,2000);assert.ok(bought.data.user.inventory.includes('gold'));
  const friend=await api('/api/friends/request',{id:b.data.user.id},a.cookie);assert.ok(friend.data.ok);
  const accepted=await api('/api/friends/accept',{id:a.data.user.id},b.cookie);assert.ok(accepted.data.ok);
  const listed=await api('/api/friends',null,a.cookie);assert.equal(listed.data.friends[0].status,'accepted');
  const config=await api('/api/config');assert.equal(config.data.providers.google,false);
 }finally{processServer.kill('SIGTERM');rmSync(tmp,{recursive:true,force:true});}
});