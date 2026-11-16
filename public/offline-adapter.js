// Free, browser-local Seega. Remote friends, cross-device leaderboards and online voice need a shared backend.
import {initialGame,applyAction,aiAction} from './game-engine.js';
const key='seega_royale_demo_v2';
const colors=['ruby','ocean','sun','jade'];
const gifts=[
 {id:'heart',emoji:'💗',name:'قلوب',price:5},{id:'egg',emoji:'🥚',name:'حدف بيض',price:10},
 {id:'hammer',emoji:'🔨',name:'شواكيش',price:15},{id:'water',emoji:'🪣',name:'جردل مية',price:20},
 {id:'rose',emoji:'🌹',name:'ورد',price:8},{id:'cake',emoji:'🎂',name:'تورتة',price:20},
 {id:'confetti',emoji:'🎉',name:'قصاصات',price:5},{id:'splash',emoji:'💦',name:'طرطشة',price:10}
];
const items=[
 {id:'classic',name:'الطقم الكلاسيكي',icon:'♟️',category:'skin',price:0,currency:'coins'},
 {id:'gold',name:'حجارة فرعونية',icon:'👑',category:'skin',price:950,currency:'coins'},
 {id:'emerald',name:'زمرد النيل',icon:'💚',category:'skin',price:60,currency:'gems'},
 {id:'pharaoh',name:'هيبة الفرعون',icon:'🏺',category:'skin',price:120,currency:'gems'},
 {id:'fire',name:'شرارة النصر',icon:'🔥',category:'skin',price:1600,currency:'coins'},
 {id:'royal',name:'طقم ملكي',icon:'💎',category:'skin',price:180,currency:'gems'}
];
let me=null,currentRoom=null;
const listeners=new Map();
function uid(){const a=new Uint8Array(5);crypto.getRandomValues(a);return 'SG-'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function weekKey(date=Date.now()){
 const f=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'});
 const p=Object.fromEntries(f.formatToParts(new Date(date)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
 const d=new Date(Date.UTC(p.year,p.month-1,p.day));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
const leagueNames=['برونز 🥉','فضة 🥈','ذهب 🥇','ماس 💎'];
function rollSeason(){
 if(!me)return;
 if(!me.season)me.season={week:weekKey(),points:0,wins:0,games:0,captures:0};
 const newWeek=weekKey();if(me.season.week===newWeek)return;
 const gap=Math.max(1,Math.min(52,Math.floor((Date.parse(newWeek)-Date.parse(me.season.week))/604800000)||1));
 me.history=me.history||[];
 for(let k=0;k<gap;k++){
  const s=k?{week:'أسبوع سابق',points:0,wins:0,games:0,captures:0}:me.season;
  const tier=me.leagueTier||0,before=tier;
  const promote=[220,450,750,Number.POSITIVE_INFINITY][tier];
  const demote=[0,60,150,300][tier];
  if(s.points>=promote&&tier<3)me.leagueTier=tier+1;
  else if(tier>0&&s.points<demote)me.leagueTier=tier-1;
  const award=s.games>0?([120,250,500,900][before]+Math.min(1000,s.points)):0;
  const gems=s.games>0?[2,5,10,20][before]:0;
  me.coins+=award;me.gems+=gems;
  me.history.unshift({...s,from:leagueNames[before],to:leagueNames[me.leagueTier],reward:award,gems});
 }
 me.history=me.history.slice(0,12);me.season={week:newWeek,points:0,wins:0,games:0,captures:0};
 save();
}
function save(){if(!me)return;try{localStorage.setItem(key,JSON.stringify(me));}catch(e){console.warn('Browser storage full',e);}}
try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old&&Array.isArray(old.inventory))me=old;}catch{}
if(me){if(!me.id||me.id==='demo')me.id=uid();me.color=colors.includes(me.color)?me.color:'ruby';me.totalCaptures??=0;me.bestCaptures??=0;me.leagueTier??=0;me.contacts??=[];me.history??=[];me.settings??={sound:true};rollSeason();save();}
let signedOut=false;try{signedOut=sessionStorage.getItem('seega_signed_out')==='1';}catch{}
const pub=()=>structuredClone(me);
const fail=(status,error)=>({status,error});
function robot(){return {id:'bot',name:'الروبوت رمسيس',avatar:'🤖',equipped:'gold',color:colors.find(c=>c!==me.color)||'ocean'};}
function deliver(name,obj){for(const fn of listeners.get(name)||[]){try{fn(obj);}catch(e){console.error(e);}}}
const roomSafe=()=>currentRoom&&structuredClone(currentRoom);
function settle(){
 if(!currentRoom||currentRoom.status!=='playing'||currentRoom.game.winner===null)return;
 currentRoom.status='finished';const v=currentRoom.game.winner,g=currentRoom.game,ours=g.capturedBy?.[0]||0;
 me.coins+=v===0?60:v==='draw'?20:10;
 me.xp+=v===0?90:v==='draw'?35:20;
 if(v===0)me.wins++;else if(v==='draw')me.draws++;else me.losses++;
 me.totalCaptures=(me.totalCaptures||0)+ours;me.bestCaptures=Math.max(me.bestCaptures||0,ours);
 rollSeason();me.season.points+=ours*8+(v===0?100:v==='draw'?35:10);me.season.games++;me.season.captures+=ours;if(v===0)me.season.wins++;
 save();deliver('wallet:update',pub());
}
function robotMove(){
 if(!currentRoom||currentRoom.kind!=='bot'||currentRoom.status!=='playing'||currentRoom.game.turn!==1)return;
 const room=currentRoom;
 setTimeout(()=>{
  if(currentRoom!==room||room.status!=='playing'||room.game.turn!==1)return;
  const act=aiAction(room.game,1);if(!act)return;
  const out=applyAction(room.game,1,act);
  if(out.ok){room.game=out.game;settle();deliver('room:update',roomSafe());if(room.status==='playing'&&room.game.turn===1)robotMove();}
 },1050);
}
function startRoom(kind='bot',size=5){
 if(![5,7].includes(+size))return fail(400,'اختار ٥×٥ أو ٧×٧');
 const second=kind==='local'?{id:'local2',name:'اللاعب الثاني',avatar:'🧑‍🤝‍🧑',equipped:'classic',color:colors.find(c=>c!==me.color)||'ocean'}:robot();
 currentRoom={id:kind==='local'?'LOCAL2':'BOT001',kind,status:'playing',owner:me.id,players:[pub(),second],game:initialGame(+size),chat:[],count:2};
 return {room:roomSafe()};
}
function message(path,method,body={}){
 if(path==='/config')return {items,providers:{google:false,facebook:false},iceServers:[],colors,gifts,mode:'offline'};
 if(path==='/me'&&method==='GET')return {user:signedOut?null:me?pub():null};
 if(path==='/auth/guest'&&method==='POST'){
  if(!me){me={id:uid(),name:String(body.name||'لاعب سيجا').trim().slice(0,24)||'لاعب سيجا',avatar:'🦁',photo:null,email:null,coins:2500,gems:75,xp:0,wins:0,losses:0,draws:0,totalCaptures:0,bestCaptures:0,leagueTier:0,history:[],contacts:[],color:'ruby',daily_claim:0,inventory:['classic'],equipped:'classic',settings:{sound:true},season:{week:weekKey(),points:0,games:0,wins:0,captures:0}};save();}
  signedOut=false;try{sessionStorage.removeItem('seega_signed_out');}catch{}rollSeason();return {user:pub()};
 }
 if(path.startsWith('/auth/')&&method==='POST'&&path!=='/auth/logout')return fail(503,'الدخول بالإيميل والسوشيال محتاج سيرفر آمن. جرّب اللعب كضيف');
 if(path==='/auth/logout'&&method==='POST'){signedOut=true;currentRoom=null;try{sessionStorage.setItem('seega_signed_out','1');}catch{}return {ok:true};}
 if(!me||signedOut)return fail(401,'ابدأ تجربة كضيف الأول');
 if(path==='/me'&&method==='PATCH'){
  if(body.name)me.name=String(body.name).trim().slice(0,24);
  if(body.avatar&&String(body.avatar).length<=8){me.avatar=body.avatar;me.photo=null;}
  if(body.photo===null)me.photo=null;
  if(typeof body.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.photo)&&body.photo.length<=170000)me.photo=body.photo;
  if(colors.includes(body.color)){
   me.color=body.color;
   if(currentRoom){currentRoom.players[0].color=me.color;if(currentRoom.players[1].color===me.color)currentRoom.players[1].color=colors.find(c=>c!==me.color);}
  }
  if(body.settings)me.settings={...me.settings,...body.settings};
  save();if(currentRoom)currentRoom.players[0]={...pub()};return {user:pub()};
 }
 if(path==='/store')return {items};
 if(path==='/daily'&&method==='POST'){
  if(Date.now()-me.daily_claim<20*3600000)return fail(409,'الهدية اليومية استلمتها بالفعل. جرّب بكرة');
  me.daily_claim=Date.now();me.coins+=450;me.gems+=10;me.xp+=35;save();return {user:pub()};
 }
 if(path==='/store/buy'&&method==='POST'){
  const item=items.find(i=>i.id===body.id);if(!item)return fail(404,'المنتج مش موجود');
  if(me.inventory.includes(item.id))return fail(409,'عندك الطقم بالفعل');
  if(me[item.currency]<item.price)return fail(400,'رصيدك مش كفاية');
  me[item.currency]-=item.price;me.inventory.push(item.id);save();return {user:pub()};
 }
 if(path==='/store/equip'&&method==='POST'){
  if(!me.inventory.includes(body.id))return fail(403,'لازم تشتري الطقم الأول');
  me.equipped=body.id;save();if(currentRoom)currentRoom.players[0]={...pub()};return {user:pub()};
 }
 if(path==='/bot'&&method==='POST')return startRoom('bot',body.size||5);
 if(path==='/local'&&method==='POST')return startRoom('local',body.size||5);
 if(path==='/rooms'&&method==='GET')return {rooms:[]};
 if(path.startsWith('/leaderboard'))return {users:[pub()],scope:'local-only',mode:'offline'};
 if(path==='/season')return {tier:me.leagueTier,season:me.season,history:me.history,tiers:leagueNames,scope:'local-only'};
 if(path.startsWith('/users/search'))return {users:[]};
 if(path==='/friends')return {friends:(me.contacts||[]).map(c=>({user:{id:c.id,name:c.name,avatar:'👤',coins:null},status:'local',incoming:false}))};
 if(path==='/friends/request'&&method==='POST'){
  const id=String(body.id||'').trim().toUpperCase();
  if(!/^SG-[0-9A-F]{10}$/.test(id))return fail(400,'الـ ID لازم يكون بالشكل SG-XXXXXXXXXX');
  if(id===me.id)return fail(400,'ده ID حسابك');
  if(me.contacts.some(c=>c.id===id))return {ok:false};
  me.contacts.push({id,name:String(body.name||'صاحب برقم ID').trim().slice(0,24)});save();return {ok:true,savedOnly:true};
 }
 if(path.startsWith('/dm/'))return {messages:[]};
 if(path.startsWith('/friends/'))return fail(503,'إضافة الصحاب الفعلية عبر الأجهزة محتاجة قاعدة بيانات مشتركة');
 if((path==='/quick'||path==='/rooms'||/\/rooms\/[^/]+\/join/.test(path))&&method==='POST')return fail(503,'الأونلاين الحقيقي محتاج خادم مشترك. العب ضد رمسيس أو مع صاحبك على نفس الجهاز');
 if(path.startsWith('/rooms/')&&method==='GET')return currentRoom&&path===`/rooms/${currentRoom.id}`?{room:roomSafe()}:fail(404,'الغرفة غير موجودة');
 if(path.endsWith('/leave')&&method==='POST'){currentRoom=null;return {ok:true};}
 return fail(404,'الميزة دي محتاجة الخادم الأونلاين');
}
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,opts={})=>{
 const path=typeof input==='string'?input:input.url;
 if(!path.startsWith('/api'))return nativeFetch(input,opts);
 const method=(opts.method||'GET').toUpperCase();let body={};try{body=JSON.parse(opts.body||'{}');}catch{}
 const result=message(path.slice(4),method,body),status=result.status||200;
 return new Response(JSON.stringify(status>=400?{error:result.error}:result),{status,headers:{'Content-Type':'application/json'}});
};
window.io=()=>{
 const sock={connected:true,on(event,cb){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(cb);return sock;},once(event,cb){if(event==='connect')queueMicrotask(cb);else sock.on(event,cb);return sock;},disconnect(){listeners.clear();},emit(event,data,cb=()=>{}){
  if(event==='room:subscribe')return cb(currentRoom?{room:roomSafe()}:{error:'الغرفة مش موجودة'});
  if(event==='game:action'){
   if(!currentRoom||currentRoom.id!==data.id)return cb({error:'مش دورك'});
   const actor=currentRoom.kind==='local'?currentRoom.game.turn:0;
   if(currentRoom.game.turn!==actor)return cb({error:'مش دورك'});
   const out=applyAction(currentRoom.game,actor,data.action);
   if(!out.ok)return cb({error:out.error});currentRoom.game=out.game;settle();cb({ok:true});deliver('room:update',roomSafe());if(currentRoom.status==='playing')robotMove();return;
  }
  if(event==='color:choose'){
   if(!currentRoom||![0,1].includes(data.seat)||!colors.includes(data.color))return cb({error:'اختيار اللون غير صحيح'});
   const mySeat=data.seat===0;
   if(!mySeat&&currentRoom.kind!=='local')return cb({error:'لون المنافس بيختاره بنفسه'});
   if(currentRoom.players[1-data.seat].color===data.color){
    if(currentRoom.kind==='bot'&&data.seat===0)currentRoom.players[1].color=colors.find(c=>c!==data.color);
    else return cb({error:'لازم كل لاعب يكون ليه لون مختلف'});
   }
   currentRoom.players[data.seat].color=data.color;if(mySeat){me.color=data.color;save();deliver('wallet:update',pub());}
   cb({ok:true});deliver('room:update',roomSafe());return;
  }
  if(event==='gift:send'){
   if(!currentRoom||currentRoom.id!==data.id)return cb({error:'مفيش جولة'});
   const gift=gifts.find(x=>x.id===data.gift);if(!gift)return cb({error:'الهدية مش موجودة'});
   if(me.coins<gift.price)return cb({error:'كويناتك مش كفاية'});
   me.coins-=gift.price;save();
   const actor=currentRoom.kind==='local'?currentRoom.game.turn:0;
   const reaction={id:gift.id,emoji:gift.emoji,name:gift.name,from:actor,to:actor===0?1:0,at:Date.now()};
   const chat={uid:currentRoom.players[actor].id,name:currentRoom.players[actor].name,avatar:currentRoom.players[actor].avatar,text:`${gift.emoji} ${gift.name} للخصم`,at:Date.now()};
   currentRoom.chat.push(chat);
   cb({ok:true});deliver('chat:new',chat);deliver('gift:new',reaction);deliver('wallet:update',pub());return;
  }
  if(event==='chat:send'){
   if(!currentRoom)return cb({error:'مافيش جولة'});
   const actor=currentRoom.kind==='local'?currentRoom.game.turn:0;
   const m={uid:currentRoom.players[actor].id,name:currentRoom.players[actor].name,avatar:currentRoom.players[actor].avatar,text:String(data.text||'').slice(0,200),at:Date.now()};
   currentRoom.chat.push(m);cb({ok:true});deliver('chat:new',m);return;
  }
  if(event==='voice:leave')return cb({ok:true});
  return cb({error:'الميزة دي غير متاحة في نسخة اللعب المحلي'});
 }};return sock;
};
await import('./app.js');