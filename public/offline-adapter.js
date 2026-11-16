// Free, browser-local Seega. Remote friends, cross-device leaderboards and online voice need a shared backend.
import {initialGame,applyAction,aiAction} from './game-engine.js';
import {initialVariant,variantApply,variantAI} from './variants.js';
const key='seega_royale_demo_v2';
const accountKey='seega_royale_device_email_accounts_v1';
const federatedKey='seega_royale_federated_accounts_v1';
let emailAccounts={};let federationAccounts={};
try{emailAccounts=JSON.parse(localStorage.getItem(accountKey)||'{}')||{};}catch{}
try{federationAccounts=JSON.parse(localStorage.getItem(federatedKey)||'{}')||{};}catch{}
const colors=['ruby','ocean','sun','jade'];
const gifts=[
 {id:'heart',emoji:'💗',name:'قلوب',price:2,currency:'gems'},
 {id:'cake',emoji:'🎂',name:'تورتة',price:4,currency:'gems'},
 {id:'egg',emoji:'🥚',name:'حدف بيض',price:3,currency:'coins'},
 {id:'hammer',emoji:'🔨',name:'شواكيش',price:5,currency:'coins'},
 {id:'water',emoji:'🪣',name:'جردل مية',price:6,currency:'coins'},
 {id:'rose',emoji:'🌹',name:'ورد',price:3,currency:'coins'},
 {id:'confetti',emoji:'🎉',name:'قصاصات',price:2,currency:'coins'},
 {id:'splash',emoji:'💦',name:'طرطشة',price:4,currency:'coins'}
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
function save(){if(!me)return;try{localStorage.setItem(key,JSON.stringify(me));if(me.email&&!me.provider&&emailAccounts[String(me.email).toLowerCase()]){emailAccounts[String(me.email).toLowerCase()].user=structuredClone(me);localStorage.setItem(accountKey,JSON.stringify(emailAccounts));}if(me.firebaseUid&&me.provider){const id=me.provider+':'+me.firebaseUid;if(federationAccounts[id]){federationAccounts[id]=structuredClone(me);localStorage.setItem(federatedKey,JSON.stringify(federationAccounts));}}}catch(e){console.warn('Browser storage full',e);}}
try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old&&Array.isArray(old.inventory))me=old;}catch{}
if(me){if(!me.id||me.id==='demo')me.id=uid();me.color=colors.includes(me.color)?me.color:'ruby';me.totalCaptures??=0;me.bestCaptures??=0;me.leagueTier??=0;me.contacts??=[];me.history??=[];me.settings??={sound:true};if(me.settings.music===undefined)me.settings.music=true;rollSeason();save();}
let signedOut=false;try{signedOut=sessionStorage.getItem('seega_signed_out')==='1';}catch{}
const pub=()=>structuredClone(me);
const fail=(status,error)=>({status,error});
function newProfile(name,email=null){return{id:uid(),name:String(name||'لاعب سيجا').trim().slice(0,24)||'لاعب سيجا',avatar:'🦁',photo:null,email,coins:2500,gems:75,xp:0,wins:0,losses:0,draws:0,totalCaptures:0,bestCaptures:0,leagueTier:0,history:[],contacts:[],color:'ruby',daily_claim:0,inventory:['classic'],equipped:'classic',settings:{sound:true,music:true},season:{week:weekKey(),points:0,games:0,wins:0,captures:0}};}
const bytesHex=arr=>Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
async function hashPassword(pass,salt){const input=new TextEncoder().encode(pass),key=await crypto.subtle.importKey('raw',input,{name:'PBKDF2'},false,['deriveBits']);const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g).map(x=>parseInt(x,16))),iterations:180000,hash:'SHA-256'},key,256);return bytesHex(new Uint8Array(result));}
function markSignedIn(){signedOut=false;try{sessionStorage.removeItem('seega_signed_out');}catch{}}
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
const makeGame=(mode='seega5',size=5)=>mode.startsWith('seega')?initialGame(Number(mode.slice(5))||size):initialVariant(mode);
const moveGame=(g,p,act)=>g.variant?variantApply(g,p,act):applyAction(g,p,act);
const smartMove=(g,p)=>g.variant?variantAI(g,p):aiAction(g,p);
function robotMove(){
 if(!currentRoom||currentRoom.kind!=='bot'||currentRoom.status!=='playing'||currentRoom.game.turn!==1)return;
 const room=currentRoom;
 setTimeout(()=>{
  if(currentRoom!==room||room.status!=='playing'||room.game.turn!==1)return;
  const act=smartMove(room.game,1);if(!act)return;
  const out=moveGame(room.game,1,act);
  if(out.ok){room.game=out.game;settle();deliver('room:update',roomSafe());if(room.status==='playing'&&room.game.turn===1)robotMove();}
 },1050);
}
function startRoom(kind='bot',size=5,mode=`seega${size}`){
 if(!['seega5','seega7','seega9','american','russian','chinese'].includes(mode))return fail(400,'اختار نوع اللعبة');
 const second=kind==='local'?{id:'local2',name:'اللاعب الثاني',avatar:'🧑‍🤝‍🧑',equipped:'classic',color:colors.find(c=>c!==me.color)||'ocean'}:robot();
 currentRoom={id:kind==='local'?'LOCAL2':'BOT001',kind,status:'playing',owner:me.id,players:[pub(),second],game:makeGame(mode,size),mode,chat:[],count:2};
 return {room:roomSafe()};
}
// Online P2P rooms: PeerJS free public signaling + WebRTC encrypted data channel.
// No permanent database, no global matchmaking and no guaranteed NAT traversal.
let p2p={peer:null,conn:null,host:false,roomId:null,remoteVoice:false,closed:true};
const clone=x=>structuredClone(x);
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code6=()=>{const bytes=crypto.getRandomValues(new Uint8Array(6));return [...bytes].map(x=>alphabet[x%alphabet.length]).join('');};
function sendP2P(data){try{if(p2p.conn?.open){p2p.conn.send(data);return true;}}catch(e){console.warn('P2P send',e);}return false;}
function stopP2P(){const old=p2p;p2p={peer:null,conn:null,host:false,roomId:null,remoteVoice:false,closed:true};try{old.conn?.close();}catch{}try{old.peer?.destroy();}catch{}}
function profileForRemote(u){return {id:String(u?.id||'guest').slice(0,36),name:String(u?.name||'ضيف').slice(0,24),avatar:String(u?.avatar||'🎮').slice(0,8),color:colors.includes(u?.color)?u.color:'ocean',equipped:String(u?.equipped||'classic').slice(0,25),photo:typeof u?.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u.photo)&&u.photo.length<170000?u.photo:null};}
function setOnlineDisconnected(){if(!currentRoom||currentRoom.kind!=='online')return;currentRoom.status='waiting';deliver('room:update',roomSafe());deliver('online:status',{text:'اتقطع اتصال المنافس. جرّب غرفة جديدة أو اطلب منه يدخل بالكود تاني.'});}
function hydrateGuest(data){
 if(!data?.room||data.room.id!==p2p.roomId)return;
 const room=data.room;
 if(!['seega5','seega7','seega9','american','russian','chinese'].includes(room.mode))return;
 if(room.players?.length!==2||!Array.isArray(room.game?.board)||room.game.board.length>121)return;
 currentRoom=clone(room);deliver('room:update',roomSafe());
}
function receivePeerData(m){
 if(!m||typeof m!=='object'||!currentRoom||currentRoom.kind!=='online')return;
 if(m.t==='hello'&&p2p.host){
  const guest=profileForRemote(m.user);
  if(guest.id===me.id)guest.id+='-2';
  if(guest.color===currentRoom.players[0].color)guest.color=colors.find(c=>c!==guest.color)||'ocean';
  currentRoom.players[1]=guest;currentRoom.status='playing';currentRoom.count=2;
  sendP2P({t:'welcome',room:roomSafe()});deliver('room:update',roomSafe());deliver('online:status',{text:'✅ منافسك اتصل! يلا نلعب.'});return;
 }
 if(m.t==='state'&&!p2p.host){hydrateGuest(m);return;}
 if(m.t==='action'&&p2p.host){
  if(currentRoom.status!=='playing'||currentRoom.game.turn!==1)return sendP2P({t:'reject',reason:'مش دورك',room:roomSafe()});
  const out=moveGame(currentRoom.game,1,m.action);
  if(!out.ok)return sendP2P({t:'reject',reason:out.error,room:roomSafe()});
  currentRoom.game=out.game;settle();sendP2P({t:'state',room:roomSafe()});deliver('room:update',roomSafe());return;
 }
 if(m.t==='reject'&&!p2p.host){hydrateGuest(m);deliver('online:status',{text:String(m.reason||'الحركة دي مش مسموحة')});return;}
 if(m.t==='chat'&&m.chat){const c={kind:m.chat.kind==='gift'?'gift':'text',uid:currentRoom.players[p2p.host?1:0].id,avatar:currentRoom.players[p2p.host?1:0].avatar,name:currentRoom.players[p2p.host?1:0].name,text:String(m.chat.text||'').slice(0,200),emoji:String(m.chat.emoji||'').slice(0,6),giftName:String(m.chat.giftName||'').slice(0,40),at:Date.now()};deliver('chat:new',c);return;}
 if(m.t==='gift'){
  const x=gifts.find(g=>g.id===m.id);if(!x)return;
  const from=p2p.host?1:0,fx={id:x.id,emoji:x.emoji,name:x.name,from,to:1-from,at:Date.now()};
  deliver('gift:new',fx);deliver('chat:new',{kind:'gift',uid:currentRoom.players[from].id,emoji:x.emoji,giftName:x.name,at:Date.now()});return;
 }
 if(m.t==='color'&&colors.includes(m.color)){
  const seat=p2p.host?1:0,otherColor=currentRoom.players[1-seat]?.color;
  if(m.color===otherColor)return;
  currentRoom.players[seat].color=m.color;deliver('room:update',roomSafe());return;
 }
 if(m.t==='voiceReady'){p2p.remoteVoice=true;deliver('voice:peer-joined',{uid:currentRoom.players[p2p.host?1:0].id});return;}
 if(m.t==='voice')deliver('voice:signal',{id:currentRoom.id,from:currentRoom.players[p2p.host?1:0].id,data:m.data});
 if(m.t==='voiceoff'){p2p.remoteVoice=false;deliver('voice:peer-left',{uid:currentRoom.players[p2p.host?1:0].id});}
}
function hostConnect(conn){
 if(p2p.conn?.open){conn.close();return;}
 p2p.conn=conn;
 conn.on('data',receivePeerData);
 conn.on('close',()=>{if(p2p.conn===conn){p2p.conn=null;setOnlineDisconnected();}});
 conn.on('error',()=>setOnlineDisconnected());
}
function peerFailed(e){return /unavailable-id|ID.*taken/.test(String(e?.type||e?.message))?'الكود اتاخد بالفعل، جرب غرفة جديدة': 'خدمة الربط المجانية مش متاحة دلوقتي، حاول تاني';}
let peerLoading=null;
async function ensurePeerJs(){
 if(typeof window.Peer==='function')return true;
 if(peerLoading)return peerLoading;
 peerLoading=(async()=>{
  for(const url of ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js']){
   try{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.async=true;s.crossOrigin='anonymous';const timeout=setTimeout(()=>{s.remove();reject(Error('timeout'));},9500);s.onload=()=>{clearTimeout(timeout);resolve();};s.onerror=()=>{clearTimeout(timeout);s.remove();reject(Error('load'));};document.head.appendChild(s);});if(typeof window.Peer==='function')return true;}catch(e){console.warn('PeerJS CDN unavailable',e);}
  }
  return false;
 })();const ok=await peerLoading;peerLoading=null;return ok;
}
async function startP2PHost(mode,size){
 if(!await ensurePeerJs())return fail(503,'خدمة الأونلاين مش اتحملت. اتأكد من الإنترنت وجرب تاني');
 if(!['seega5','seega7','seega9','american','russian','chinese'].includes(mode))return fail(400,'نوع اللعبة مش مدعوم');
 stopP2P();const code=code6(),peer=new window.Peer('seegaroyal-'+code.toLowerCase(),{debug:0});
 p2p={peer,conn:null,host:true,roomId:code,remoteVoice:false,closed:false};
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('اتأخرت خدمة الربط، جرب تاني')),11000);
   peer.on('open',()=>{clearTimeout(timer);resolve();});peer.on('error',e=>{clearTimeout(timer);reject(Error(peerFailed(e)));});});
 }catch(e){stopP2P();return fail(503,e.message);}
 currentRoom={id:code,kind:'online',mode,status:'waiting',owner:me.id,players:[profileForRemote(me),{id:'waiting',name:'في انتظار صاحبك',avatar:'⏳',color:colors.find(c=>c!==me.color)||'ocean'}],game:makeGame(mode,size),chat:[],count:1};
 peer.on('connection',hostConnect);
 return {room:roomSafe()};
}
async function joinP2PRoom(code){
 if(!await ensurePeerJs())return fail(503,'خدمة الأونلاين مش اتحملت. اتأكد من الإنترنت');
 if(!/^[A-Z0-9]{6}$/.test(code))return fail(400,'كود الغرفة غلط');
 stopP2P();const peer=new window.Peer(undefined,{debug:0});p2p={peer,conn:null,host:false,roomId:code,remoteVoice:false,closed:false};
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('خدمة الربط مش متاحة، جرّب مرة تانية')),11000);
   peer.on('open',()=>{clearTimeout(timer);resolve();});peer.on('error',e=>{clearTimeout(timer);reject(Error(peerFailed(e)));});});
  const conn=peer.connect('seegaroyal-'+code.toLowerCase(),{reliable:true,serialization:'json'});p2p.conn=conn;
  const room=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('الغرفة مش متاحة، صاحبك لازم يسيبها مفتوحة ويتأكد من الاتصال')),16000);
   conn.on('open',()=>conn.send({t:'hello',user:profileForRemote(me)}));
   conn.on('data',data=>{if(data.t==='welcome'&&data.room?.id===code){clearTimeout(timer);resolve(data.room);}});
   conn.on('error',()=>{clearTimeout(timer);reject(Error('الاتصال بالغرفة فشل'));});
   conn.on('close',()=>{clearTimeout(timer);reject(Error('صاحب الغرفة فصل قبل ما ندخل'));});
  });
  currentRoom=clone(room);
  conn.removeAllListeners('data');conn.on('data',receivePeerData);
  conn.on('close',()=>setOnlineDisconnected());
  conn.on('error',()=>setOnlineDisconnected());
  return {room:roomSafe()};
 }catch(e){stopP2P();return fail(503,e.message);}
}
function onlineEvent(event,data,cb){
 if(event==='game:action'){
  if(!currentRoom||currentRoom.status!=='playing')return cb({error:'لسه صاحبك مادخلش'});
  const mine=p2p.host?0:1;
  if(currentRoom.game.turn!==mine)return cb({error:'استنى دورك'});
  if(!p2p.host){if(!sendP2P({t:'action',action:data.action}))return cb({error:'الاتصال مقطوع'});return cb({ok:true});}
  const result=moveGame(currentRoom.game,0,data.action);
  if(!result.ok)return cb({error:result.error});
  currentRoom.game=result.game;settle();sendP2P({t:'state',room:roomSafe()});cb({ok:true});deliver('room:update',roomSafe());return;
 }
 if(event==='chat:send'){
  const str=String(data.text||'').trim().slice(0,200);if(!str)return cb({error:'رسالتك فاضية'});
  const seat=p2p.host?0:1;
  const chat={uid:me.id,name:me.name,avatar:me.avatar,text:str,at:Date.now()};
  deliver('chat:new',chat);sendP2P({t:'chat',chat});cb({ok:true});return;
 }
 if(event==='gift:send'){
  const gift=gifts.find(g=>g.id===data.gift);if(!gift)return cb({error:'الهدية غير موجودة'});
  if(me[gift.currency]<gift.price)return cb({error:'الرصيد مش كفاية'});
  me[gift.currency]-=gift.price;save();deliver('wallet:update',pub());
  const from=p2p.host?0:1,fx={id:gift.id,emoji:gift.emoji,name:gift.name,from,to:1-from,at:Date.now()};
  deliver('gift:new',fx);deliver('chat:new',{kind:'gift',uid:me.id,emoji:gift.emoji,giftName:gift.name,at:Date.now()});
  sendP2P({t:'gift',id:gift.id});cb({ok:true});return;
 }
 if(event==='color:choose'){
  const seat=p2p.host?0:1;
  if(data.seat!==seat)return cb({error:'اختار لونك انت بس'});
  if(!colors.includes(data.color)||currentRoom.players[1-seat].color===data.color)return cb({error:'اختار لون مختلف'});
  currentRoom.players[seat].color=data.color;me.color=data.color;save();
  sendP2P({t:'color',color:data.color});deliver('room:update',roomSafe());deliver('wallet:update',pub());cb({ok:true});return;
 }
 if(event==='voice:join'){sendP2P({t:'voiceReady'});return cb({peers:p2p.host&&p2p.remoteVoice&&currentRoom.status==='playing'?[currentRoom.players[1].id]:[]});}
 if(event==='voice:signal'){if(!sendP2P({t:'voice',data:data.data}))return cb({error:'الصوت مش متصل'});return cb({ok:true});}
 if(event==='voice:leave'){sendP2P({t:'voiceoff'});return cb({ok:true});}
 return cb({error:'الميزة دي مش متاحة في الغرفة'});
}
async function message(path,method,body={}){
 if(path==='/config')return {items,providers:{google:false,facebook:false,emailDevice:true},iceServers:[{urls:'stun:stun.l.google.com:19302'}],colors,gifts,mode:'peer-to-peer'};
 if(path==='/me'&&method==='GET')return {user:signedOut?null:me?pub():null};
 if(path==='/auth/guest'&&method==='POST'){
  if(!me||me.email||me.provider){me=newProfile(body.name||'لاعب سيجا');}
  if(!me.settings)me.settings={sound:true,music:true};
  markSignedIn();rollSeason();save();return {user:pub()};
 }
 if(path==='/auth/register'&&method==='POST'){
  const email=String(body.email||'').trim().toLowerCase(),pass=String(body.password||''),name=String(body.name||'لاعب سيجا').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>150)return fail(400,'الإيميل غير صحيح');
  if(pass.length<8||pass.length>128)return fail(400,'كلمة السر لازم تكون من ٨ إلى ١٢٨ حرف');
  if(emailAccounts[email])return fail(409,'الإيميل ده مسجل على نفس الجهاز؛ اختار تسجيل دخول');
  const salt=bytesHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash=await hashPassword(pass,salt);
  me=me&&!me.email&&!me.provider?{...me,name:name.slice(0,24),email}:{...newProfile(name,email)};
  emailAccounts[email]={salt,hash,user:structuredClone(me)};
  markSignedIn();save();return {user:pub(),scope:'device-only'};
 }
 if(path==='/auth/login'&&method==='POST'){
  const email=String(body.email||'').trim().toLowerCase(),account=emailAccounts[email];
  if(!account)return fail(401,'الحساب ده مش محفوظ على الجهاز. أنشئ حساب جديد أو استخدم نفس الجهاز القديم');
  const hash=await hashPassword(String(body.password||''),account.salt);
  if(hash!==account.hash)return fail(401,'كلمة السر غير صحيحة');
  me=structuredClone(account.user);me.settings??={sound:true};if(me.settings.music===undefined)me.settings.music=true;markSignedIn();save();return {user:pub(),scope:'device-only'};
 }
 if(path==='/auth/federated'&&method==='POST'){
  // Firebase handles external OAuth. Game progression stays local until a shared
  // database with verified server-side Firebase tokens has been provisioned.
  if(!['google','facebook'].includes(body.provider)||typeof body.uid!=='string'||!body.uid)return fail(400,'طريقة الدخول غير صحيحة');
  const id=body.provider+':'+body.uid;
  me=federationAccounts[id]||newProfile(body.name||'لاعب سيجا',body.email||null);
  me.firebaseUid=body.uid;me.provider=body.provider;
  federationAccounts[id]=structuredClone(me);
  markSignedIn();save();return {user:pub(),scope:'device-only'};
 }
 if(path==='/auth/logout'&&method==='POST'){stopP2P();signedOut=true;currentRoom=null;try{sessionStorage.setItem('seega_signed_out','1');}catch{}return {ok:true};}
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
 if(path==='/bot'&&method==='POST'){stopP2P();return startRoom('bot',body.size||5,body.mode||`seega${body.size||5}`);}
 if(path==='/local'&&method==='POST'){stopP2P();return startRoom('local',body.size||5,body.mode||`seega${body.size||5}`);}
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
 if((path==='/rooms'||path==='/quick')&&method==='POST')return startP2PHost(body.mode||`seega${body.size||5}`,body.size||5);
 if(/\/rooms\/[A-Z0-9]{6}\/join/i.test(path)&&method==='POST')return joinP2PRoom(path.split('/')[2]);
 if(path.startsWith('/rooms/')&&method==='GET')return currentRoom&&path===`/rooms/${currentRoom.id}`?{room:roomSafe()}:fail(404,'الغرفة غير موجودة');
 if(path.endsWith('/leave')&&method==='POST'){stopP2P();currentRoom=null;return {ok:true};}
 return fail(404,'الميزة دي محتاجة الخادم الأونلاين');
}
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,opts={})=>{
 const path=typeof input==='string'?input:input.url;
 if(!path.startsWith('/api'))return nativeFetch(input,opts);
 const method=(opts.method||'GET').toUpperCase();let body={};try{body=JSON.parse(opts.body||'{}');}catch{}
 const result=await message(path.slice(4),method,body),status=result.status||200;
 return new Response(JSON.stringify(status>=400?{error:result.error}:result),{status,headers:{'Content-Type':'application/json'}});
};
window.io=()=>{
 const sock={connected:true,on(event,cb){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(cb);return sock;},once(event,cb){if(event==='connect')queueMicrotask(cb);else sock.on(event,cb);return sock;},disconnect(){listeners.clear();},emit(event,data,cb=()=>{}){
  if(event==='room:subscribe')return cb(currentRoom?{room:roomSafe()}:{error:'الغرفة مش موجودة'});
  if(currentRoom?.kind==='online')return onlineEvent(event,data,cb);
  if(event==='game:action'){
   if(!currentRoom||currentRoom.id!==data.id)return cb({error:'مش دورك'});
   const actor=currentRoom.kind==='local'?currentRoom.game.turn:0;
   if(currentRoom.game.turn!==actor)return cb({error:'مش دورك'});
   const out=moveGame(currentRoom.game,actor,data.action);
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
   const currency=gift.currency==='gems'?'gems':'coins';
   if(me[currency]<gift.price)return cb({error:currency==='gems'?'الجواهر مش كفاية للهدية دي':'كويناتك مش كفاية للهدية دي'});
   me[currency]-=gift.price;save();
   const actor=currentRoom.kind==='local'?currentRoom.game.turn:0;
   const reaction={id:gift.id,emoji:gift.emoji,name:gift.name,from:actor,to:actor===0?1:0,at:Date.now()};
   const chat={kind:'gift',uid:currentRoom.players[actor].id,emoji:gift.emoji,giftName:gift.name,at:Date.now()};
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
await import('./app.js?v=5');