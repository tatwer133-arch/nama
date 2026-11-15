import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
const port=await new Promise((res,rej)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});s.on('error',rej);});
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
for(let i=0;i<60;i++){try{let r=await fetch(base+'/healthz');if(r.ok)break;}catch{}await new Promise(res=>setTimeout(res,50));}
async function api(path,body){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return r.json();}
test.after(()=>child.kill());
test('HTTP serves Android-style UI, icon, manifest, transport',async()=>{
 for(const path of ['/','/app.js','/styles.css','/socket.io/socket.io.js','/manifest.json','/icon.svg']){
  const res=await fetch(base+path);assert.equal(res.status,200,path);
 }
 const home=await (await fetch(base+'/')).text();assert.match(home,/السيجا الفلاحي/);
});
test('multiplayer: room, token, remote join, turns and validation, reconnect',async()=>{
 const a=await api('create_room',{name:'أحمد',size:5,drops:2});assert.equal(a.ok,true);assert.equal(a.code.length,6);
 let aPoll=await api('poll',{code:a.code,token:a.token,since:-1});assert.equal(aPoll.room_state.you,0);
 const b=await api('join_room',{code:a.code,name:'محمد'});assert.equal(b.ok,true);assert.notEqual(b.token,a.token);
 const bPoll=await api('poll',{code:a.code,token:b.token,since:-1});assert.equal(bPoll.room_state.players[0].name,'أحمد');assert.equal(bPoll.room_state.players[1].name,'محمد');assert.equal(bPoll.room_state.you,1);
 const denied=await api('join_room',{code:a.code,name:'دخيل'});assert.equal(denied.ok,false);
 const wrong=await api('play',{code:a.code,token:b.token,action:{type:'place',at:0}});assert.equal(wrong.ok,false);
 const first=await api('play',{code:a.code,token:a.token,action:{type:'place',at:0}});assert.equal(first.ok,true);
 const second=await api('play',{code:a.code,token:a.token,action:{type:'place',at:1}});assert.equal(second.ok,true);
 const next=await api('poll',{code:a.code,token:b.token,since:bPoll.version});assert.equal(next.room_state.game.turn,1);assert.equal(next.room_state.game.placed[0],2);
 const rejoin=await api('join_room',{code:a.code,name:'different name',token:b.token});assert.equal(rejoin.ok,true);assert.equal(rejoin.token,b.token);
});
test('long poll instantly publishes opponents moves',async()=>{
 const a=await api('create_room',{name:'one',size:7,drops:1});const b=await api('join_room',{code:a.code,name:'two'});
 const initial=await api('poll',{code:a.code,token:b.token,since:-1});
 const wait=api('poll',{code:a.code,token:b.token,since:initial.version});
 await new Promise(res=>setTimeout(res,100));
 const result=await api('play',{code:a.code,token:a.token,action:{type:'place',at:0}});assert.equal(result.ok,true);
 const update=await wait;assert.equal(update.room_state.game.board[0],0);assert.equal(update.room_state.game.turn,1);
});
