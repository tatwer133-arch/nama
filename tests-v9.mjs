import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import crypto from 'node:crypto';
import {initialGame,applyAction,aiAction} from './public/game-engine.js';
import {initialVariant,variantApply,variantAI} from './public/variants.js';
const peers=new Map();let generated=0;
class Conn extends EventEmitter{
 constructor(peer){super();this.open=false;this.peer=peer;this.partner=null;}
 send(data){if(!this.open||!this.partner?.open)throw Error('Closed');queueMicrotask(()=>this.partner?.emit('data',structuredClone(data)));}
 close(){this.open=false;this.emit('close');if(this.partner?.open){this.partner.open=false;this.partner.emit('close');}}
}
class FakePeer extends EventEmitter{
 constructor(id){super();this.id=id||'peer-'+(++generated);peers.set(this.id,this);setTimeout(()=>this.emit('open',this.id),3);}
 connect(id){const receiver=peers.get(id),local=new Conn(id),remote=new Conn(this.id);local.partner=remote;remote.partner=local;
  if(receiver)setTimeout(()=>{receiver.emit('connection',remote);setTimeout(()=>{local.open=true;remote.open=true;local.emit('open');remote.emit('open');},1);},2);
  else setTimeout(()=>local.emit('error',Error('No host')),3);
  return local;
 }
 call(id,stream){const o={peer:id,close(){}};return o;}
 destroy(){peers.delete(this.id);this.emit('close');}
}
function adapter(){
 const entries=new Map(),storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
 const window={Peer:FakePeer,fetch:async()=>({})};
 const code=readFileSync(new URL('./public/offline-adapter.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/app\.js\?v=\d+'\);/,'');
 const maker=new Function('initialGame','applyAction','aiAction','initialVariant','variantApply','variantAI','window','localStorage','sessionStorage','crypto','structuredClone','Response','setTimeout','clearTimeout',code+'\nreturn {message, getRoom:roomSafe, stopP2P, window};');
 return maker(initialGame,applyAction,aiAction,initialVariant,variantApply,variantAI,window,storage,storage,crypto.webcrypto,structuredClone,Response,setTimeout,clearTimeout);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(sock,name,data)=>new Promise(resolve=>sock.emit(name,data,resolve));
async function paired(){
 const h=adapter(),g=adapter();await h.message('/auth/guest','POST',{name:'ملك'});await g.message('/auth/guest','POST',{name:'مها'});
 const hs=h.window.io(),gs=g.window.io();const created=await h.message('/rooms','POST',{mode:'seega5',size:5}),code=created.room.id;
 const joined=await g.message('/rooms/'+code+'/join','POST',{});assert(joined.room,joined.error);await wait(20);
 return {h,g,hs,gs,code};
}
test('spectators require both players consent and cannot move pieces or give gifts',async()=>{
 const {h,g,hs,gs,code}=await paired(),event=[];
 gs.on('spectator:request',()=>event.push('request'));
 const pending=await emit(hs,'spectator:toggle',{allow:true});assert.equal(pending.pending,true);await wait(5);assert.deepEqual(event,['request']);
 let rejected=await emit(gs,'spectator:response',{accept:false});assert(rejected.ok);await wait(10);assert.equal(h.getRoom().allowSpectators,false);
 const again=await emit(hs,'spectator:toggle',{allow:true});assert.equal(again.pending,true);
 assert((await emit(gs,'spectator:response',{accept:true})).ok);await wait(10);assert.equal(h.getRoom().allowSpectators,true);
 const v=adapter();const viewer=(await v.message('/auth/guest','POST',{name:'مشاهد ١'})).user;
 const vs=v.window.io(),watch=await v.message('/rooms/'+code+'/watch','POST',{});assert(watch.room,watch.error);assert.equal(watch.room.watchOnly,true);
 await wait(10);assert.equal(h.getRoom().viewers[0].name,'مشاهد ١');assert.equal(h.getRoom().viewers[0].id,viewer.id);
 assert.equal((await emit(vs,'game:action',{id:code,action:{kind:'place',to:0}})).error,'المشاهد يقدر يكتب شات فقط');
 assert.equal((await emit(vs,'gift:send',{id:code,gift:'egg'})).error,'المشاهد يقدر يكتب شات فقط');
 assert.equal(h.getRoom().game.board.filter(Boolean).length,0);
 v.stopP2P();g.stopP2P();h.stopP2P();
});
test('spectator chat is visible to both players and watcher, but no microphone command',async()=>{
 const {h,g,hs,gs,code}=await paired();await emit(hs,'spectator:toggle',{allow:true});await emit(gs,'spectator:response',{accept:true});await wait(10);
 const v=adapter();await v.message('/auth/guest','POST',{name:'يوسف'});const vs=v.window.io();assert((await v.message('/rooms/'+code+'/watch','POST',{})).room);
 const got=[];hs.on('chat:new',m=>got.push(['host',m]));gs.on('chat:new',m=>got.push(['guest',m]));vs.on('chat:new',m=>got.push(['viewer',m]));
 const res=await emit(vs,'chat:send',{id:code,text:'بتفرج عليكم'});assert(res.ok);await wait(25);
 assert.equal(got.length,3);for(const [who,m] of got){assert.equal(m.text,'بتفرج عليكم',who);assert.equal(m.viewer,true);assert.equal(m.name,'يوسف');}
 assert((await emit(vs,'voice:request',{})).error);v.stopP2P();g.stopP2P();h.stopP2P();
});
test('voice request is presented before connection; receiver may reject or accept',async()=>{
 const {h,g,hs,gs}=await paired();const incoming=[],accepted=[],rejected=[];
 gs.on('voice:incoming',e=>incoming.push(e));hs.on('voice:accepted',e=>accepted.push(e));hs.on('voice:rejected',e=>rejected.push(e));
 assert((await emit(hs,'voice:request',{})).ok);await wait(6);assert.equal(incoming.length,1);assert.equal(incoming[0].from,'ملك');
 assert((await emit(gs,'voice:response',{accept:false})).ok);await wait(6);assert.equal(rejected.length,1);
 assert((await emit(hs,'voice:request',{})).ok);await wait(6);assert((await emit(gs,'voice:response',{accept:true})).ok);await wait(6);assert.equal(accepted.length,1);
 g.stopP2P();h.stopP2P();
});
test('gift popup is a body-level modal; watch routes and cloud social rules exist',()=>{
 const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./public/styles.css',import.meta.url),'utf8');
 const vercel=readFileSync(new URL('./public/vercel.json',import.meta.url),'utf8');
 const firestore=readFileSync(new URL('./firestore.rules',import.meta.url),'utf8');
 assert(app.includes("function giftModal()"));assert(app.includes('openModal(\'🎁 هدية للمنافس\''));
 assert(css.includes('#modal-root .modal-box'));assert(css.includes('.gift-grid{display:grid;grid-template-columns:repeat(3'));
 assert(JSON.parse(vercel).rewrites.some(x=>x.source==='/watch/:code'));
 assert(firestore.includes('match /friendRequests/{pairId}'));assert(firestore.includes('match /dmThreads/{pairId}/messages/{messageId}'));assert(firestore.includes('match /publicChat/{messageId}'));assert(firestore.includes('match /presence/{uid}'));
 assert(app.includes("state.unreadRoom++"));assert(app.includes('accept-call'));assert(app.includes('reject-call'));assert(app.includes('data-action="cloud-search"'));
});