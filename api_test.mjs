import assert from 'node:assert/strict';
import fs from 'node:fs';
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
globalThis.sessionStorage=globalThis.localStorage;
globalThis.window={fetch:globalThis.fetch};
const text=fs.readFileSync('./public/offline-adapter.js','utf8').replace("await import('./app.js');","export const adapterLoaded=true;");
const path='./public/.adapter-under-test.mjs';fs.writeFileSync(path,text);
try{
 await import(path+'?t='+Date.now());
 async function api(route,method='GET',body={}){const response=await window.fetch('/api'+route,{method,body:JSON.stringify(body)});return {status:response.status,...await response.json()};}
 const login=await api('/auth/guest','POST',{name:'الاختبار'});assert.equal(login.status,200);assert.match(login.user.id,/^SG-[0-9A-F]{10}$/);console.log('Guest ID',login.user.id);
 assert.equal((await api('/auth/guest','POST',{})).user.id,login.user.id);
 const b=await api('/bot','POST',{size:7});assert.equal(b.room.game.size,7);assert.equal(b.room.game.board.length,49);assert.equal(b.room.players[0].color,'ruby');assert.notEqual(b.room.players[0].color,b.room.players[1].color);console.log('7x7 bot room and unique colors OK');
 const sock=window.io();let update=null,fx=null;sock.on('room:update',v=>update=v);sock.on('gift:new',v=>fx=v);
 const color=await new Promise(resolve=>sock.emit('color:choose',{seat:0,color:'jade'},resolve));assert(color.ok);assert.equal((await api('/me')).user.color,'jade');
 const adjusted=await new Promise(resolve=>sock.emit('color:choose',{seat:0,color:b.room.players[1].color},resolve));assert(adjusted.ok);assert.notEqual(update.players[0].color,update.players[1].color);console.log('Color select and bot adjustment OK');
 const old=(await api('/me')).user.coins;
 const gift=await new Promise(resolve=>sock.emit('gift:send',{id:b.room.id,gift:'water'},resolve));assert(gift.ok);assert.equal(fx.id,'water');assert.equal((await api('/me')).user.coins,old-20);console.log('Gift cost and event OK');
 const move=await new Promise(resolve=>sock.emit('game:action',{id:b.room.id,action:{kind:'place',to:0}},resolve));assert(move.ok);assert.equal(update.game.placed[0],1);console.log('Placement action OK');
 const local=await api('/local','POST',{size:5});assert.equal(local.room.kind,'local');const duplicate=await new Promise(resolve=>sock.emit('color:choose',{seat:1,color:local.room.players[0].color},resolve));assert(duplicate.error);const second=await new Promise(resolve=>sock.emit('color:choose',{seat:1,color:'sun'},resolve));assert(second.ok);console.log('Local two-player room colors OK');
 const contact=await api('/friends/request','POST',{id:'SG-0123456789'});assert(contact.ok);assert.equal((await api('/friends')).friends.length,1);console.log('Local ID directory OK');
 const season=await api('/season');assert.equal(season.tier,0);assert.equal(season.scope,'local-only');console.log('Weekly league local scope OK');
 console.log('All adapter checks passed.');
}finally{fs.unlinkSync(path)}