import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';import crypto from 'node:crypto';
import {initialGame,applyAction,aiAction} from './public/game-engine.js';
import {initialVariant,variantApply,variantAI,variantActions,GAME_CATALOG,chineseLayout} from './public/variants.js';
const peers=new Map();let generated=0;
class FakeConn extends EventEmitter{
 constructor(){super();this.open=false;this.partner=null;}
 send(data){if(!this.open||!this.partner?.open)throw Error('Closed channel');queueMicrotask(()=>this.partner?.emit('data',structuredClone(data)));}
 close(){this.open=false;this.emit('close');if(this.partner?.open){this.partner.open=false;this.partner.emit('close');}}
}
class FakePeer extends EventEmitter{
 constructor(id){super();this.id=id||'peer-'+(++generated);peers.set(this.id,this);setTimeout(()=>this.emit('open',this.id),3);}
 connect(id){const receiver=peers.get(id),local=new FakeConn(),remote=new FakeConn();local.partner=remote;remote.partner=local;
  if(receiver){setTimeout(()=>{receiver.emit('connection',remote);setTimeout(()=>{local.open=true;remote.open=true;local.emit('open');remote.emit('open');},1)},2);}
  else setTimeout(()=>local.emit('error',new Error('No host')),3);
  return local;
 }
 destroy(){peers.delete(this.id);this.emit('close');}
}
function createAdapter(){
 const entries=new Map(),store={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
 const window={Peer:FakePeer,fetch:async()=>({})};
 const code=readFileSync(new URL('./public/offline-adapter.js',import.meta.url),'utf8')
 .replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/app\.js\?v=\d+'\);/,'');
 const maker=new Function('initialGame','applyAction','aiAction','initialVariant','variantApply','variantAI','window','localStorage','sessionStorage','crypto','structuredClone','Response','setTimeout','clearTimeout',code+'\nreturn {message, getRoom:roomSafe, stopP2P, window};');
 return maker(initialGame,applyAction,aiAction,initialVariant,variantApply,variantAI,window,store,store,crypto.webcrypto,structuredClone,Response,setTimeout,clearTimeout);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function emit(sock,name,data){return new Promise(r=>sock.emit(name,data,r));}
test('offline v4 adapter plays all six variants',async()=>{
 const a=createAdapter();await a.message('/auth/guest','POST',{name:'اختبار'});
 for(const mode of GAME_CATALOG.map(g=>g.id)){
  const out=await a.message('/bot','POST',{mode,size:5});assert(out.room,out.error);assert.equal(out.room.mode,mode);
  const socket=a.window.io(),kind=out.room.game.variant;
  const act=kind?variantActions(out.room.game)[0]:{kind:'place',to:0};
  const res=await emit(socket,'game:action',{id:out.room.id,action:act});assert(res.ok,mode+': '+JSON.stringify(res));
  a.stopP2P();
 }
});
test('host and guest exchange validated moves, chat, gift across separate browser contexts',async()=>{
 const host=createAdapter(),guest=createAdapter();
 const hUser=(await host.message('/auth/guest','POST',{name:'نور'})).user;
 const gUser=(await guest.message('/auth/guest','POST',{name:'هاني'})).user;
 assert.notEqual(hUser.id,gUser.id);
 const hostS=host.window.io(),guestS=guest.window.io(),events=[];
 hostS.on('room:update',r=>events.push({who:'host',room:r}));
 guestS.on('room:update',r=>events.push({who:'guest',room:r}));
 const created=await host.message('/rooms','POST',{mode:'american',size:8});assert.equal(created.room.status,'waiting');
 const joined=await guest.message('/rooms/'+created.room.id+'/join','POST');assert(joined.room,joined.error);assert.equal(joined.room.status,'playing');
 await sleep(10);assert.equal(host.getRoom().status,'playing');
 const g=host.getRoom().game,act=variantActions(g)[0];assert.equal(g.turn,0);
 assert.equal((await emit(hostS,'game:action',{id:created.room.id,action:act})).ok,true);
 await sleep(10);assert.equal(guest.getRoom().game.turn,1);
 const actG=variantActions(guest.getRoom().game)[0];assert.equal((await emit(guestS,'game:action',{id:created.room.id,action:actG})).ok,true);
 await sleep(10);assert.deepEqual(guest.getRoom().game.board,host.getRoom().game.board);
 const chat=[];hostS.on('chat:new',m=>chat.push(m));guestS.on('chat:new',m=>chat.push(m));
 assert.equal((await emit(guestS,'chat:send',{id:created.room.id,text:'سلام'})).ok,true);
 await sleep(10);assert.equal(chat.length,2);assert.equal(chat[0].text,'سلام');
 const gifts=[];hostS.on('gift:new',g=>gifts.push(g));guestS.on('gift:new',g=>gifts.push(g));
 assert.equal((await emit(hostS,'gift:send',{id:created.room.id,gift:'cake'})).ok,true);
 await sleep(10);assert.equal(gifts.length,2);assert.equal(gifts[0].emoji,'🍰');
 host.stopP2P();guest.stopP2P();
});
test('V4 renderers display game modes, 3D board, floating chat and Chinese star grid',()=>{
 const src=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 const start=src.indexOf('function currentModeLabel(){'),end=src.indexOf('function render(){',start);
 assert(start>0&&end>start);
 const scope=src.slice(start,end);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const me={id:'a',name:'مصطفى',avatar:'👑',color:'ruby',coins:100,gems:30,settings:{sound:true}},foe={id:'b',name:'هند',avatar:'👸',color:'jade'};
 const mock={state:{room:{id:'TEST12',kind:'online',status:'playing',game:initialVariant('chinese'),players:[me,foe],chat:[]},me,config:{gifts:[]},boardTilt:true,chatOpen:true,selected:null,giftMenuOpen:false},GAME_CATALOG,chineseLayout,variantActions,avatar:u=>`<span class="avatar-icon">${esc(u.avatar)}</span>`,tones:{ruby:['أحمر','🔴'],jade:['أخضر','🟢']},esc,fmt:x=>String(x),btn:()=>'',cap:x=>x,colorButton:()=>'',canMove:()=>false,messageMarkup:()=>'',location:{origin:'https://example.com'}};
 const result=new Function(...Object.keys(mock),scope+'\nreturn renderRoom();')(...Object.values(mock));
 assert.equal((result.match(/class="chinese-hole/g)||[]).length,121);
 assert(result.includes('board3d is-tilted'));assert(result.includes('chat-drawer'));assert(result.includes('data-action="share-room"'));
 assert(result.includes('data-action="open-settings"'));assert(result.includes('data-action="open-gifts"'));
 });