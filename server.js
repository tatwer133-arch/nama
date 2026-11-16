import express from './src/mini-http.js';
import http from 'node:http';
import {Realtime} from './src/realtime.js';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initialGame,applyAction,aiAction,other} from './src/game.js';
import {getUser,getByEmail,getByProvider,createUser,linkProvider,updateUser,spend,addWallet,leaderboards,searchUsers,requestFriend,acceptFriend,listFriends,sendDm,dms,publicUser} from './src/store.js';
const app=express(),server=http.createServer(app),io=new Realtime(server);
const PORT=Number(process.env.PORT||3000);
const BASE_URL=process.env.BASE_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${PORT}`;
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
if(!process.env.SESSION_SECRET)console.warn('SESSION_SECRET missing: sessions will reset after server restart. Set it in production!');
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:'12kb'}));
app.set('trust proxy',1);
const attempts=new Map();app.use('/api/auth', (req,res,next)=>{const ip=req.socket.remoteAddress||'unknown';const t=Date.now(),r=attempts.get(ip)||[];const active=r.filter(x=>t-x<15*60000);if(req.method==='POST'){if(active.length>=40)return res.status(429).json({error:'طلبات دخول كتير، جرّب بعد شوية'});active.push(t);}attempts.set(ip,active);next();});
const rooms=new Map(),queue=[];
const storeItems=[
 {id:'classic',name:'الطقم الكلاسيكي',icon:'♟️',category:'skin',price:0,currency:'coins'},
 {id:'gold',name:'حجارة فرعونية',icon:'👑',category:'skin',price:950,currency:'coins'},
 {id:'emerald',name:'زمرد النيل',icon:'💚',category:'skin',price:60,currency:'gems'},
 {id:'pharaoh',name:'هيبة الفرعون',icon:'🏺',category:'skin',price:120,currency:'gems'},
 {id:'fire',name:'شرارة النصر',icon:'🔥',category:'skin',price:1600,currency:'coins'},
 {id:'royal',name:'طقم ملكي',icon:'💎',category:'skin',price:180,currency:'gems'}
];
function b64(s){return Buffer.from(s).toString('base64url');}
function token(id){const data=b64(JSON.stringify({id,exp:Date.now()+30*86400000}));return data+'.'+crypto.createHmac('sha256',SECRET).update(data).digest('base64url');}
function parseCookies(header=''){return Object.fromEntries(header.split(';').map(c=>c.trim().split('=').map(decodeURIComponent)).filter(p=>p.length===2));}
function fromCookie(header){const t=parseCookies(header).seega_session;if(!t)return null;const [data,mac]=t.split('.');if(!data||!mac)return null;
 const real=crypto.createHmac('sha256',SECRET).update(data).digest('base64url');if(real.length!==mac.length||!crypto.timingSafeEqual(Buffer.from(real),Buffer.from(mac)))return null;
 try{const x=JSON.parse(Buffer.from(data,'base64url').toString());return x.exp>Date.now()?getUser(x.id):null;}catch{return null;}}
function setCookie(res,id){res.cookie('seega_session',token(id),{httpOnly:true,sameSite:'lax',secure:BASE_URL.startsWith('https://'),path:'/',maxAge:30*86400000});}
function auth(req,res,next){const u=fromCookie(req.headers.cookie);if(!u)return res.status(401).json({error:'سجل دخول الأول'});req.user=u;next();}
const safeName=x=>String(x||'').trim().slice(0,24).replace(/[<>]/g,'');
const safeText=(x,max=280)=>String(x||'').trim().slice(0,max).replace(/[<>]/g,'');
function passHash(p){const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(p,salt,64).toString('hex');}
function passCheck(p,h){try{const [salt,hex]=h.split(':');const a=crypto.scryptSync(p,salt,64),b=Buffer.from(hex,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
function replyAuth(res,u){setCookie(res,u.id);res.json({user:publicUser(u)});}
app.post('/api/auth/guest',(req,res)=>{const u=createUser({name:safeName(req.body?.name)||'لاعب جديد',avatar:'🦁'});replyAuth(res,u);});
app.post('/api/auth/register',(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase(),pass=String(req.body?.password||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||pass.length<8||pass.length>128)return res.status(400).json({error:'اكتب إيميل صحيح وباسورد ٨ حروف على الأقل'});
 if(getByEmail(email))return res.status(409).json({error:'الإيميل مستخدم بالفعل'});
 const u=createUser({email,passhash:passHash(pass),name:safeName(req.body.name)||'لاعب سيجا',provider:'email'});replyAuth(res,u);
});
app.post('/api/auth/login',(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase(),pass=String(req.body?.password||'');const u=getByEmail(email);
 if(!u||!u.passhash||!passCheck(pass,u.passhash))return res.status(401).json({error:'الإيميل أو كلمة السر غلط'});replyAuth(res,u);});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('seega_session',{path:'/'});res.json({ok:true});});
// Provider OAuth credentials must be configured by the app owner; no fake "social login".
const oauth={google:{client:process.env.GOOGLE_CLIENT_ID,secret:process.env.GOOGLE_CLIENT_SECRET,authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email profile'},facebook:{client:process.env.FACEBOOK_APP_ID,secret:process.env.FACEBOOK_APP_SECRET,authorize:'https://www.facebook.com/v21.0/dialog/oauth',token:'https://graph.facebook.com/v21.0/oauth/access_token',scope:'email,public_profile'}};
app.get('/api/auth/:provider/start',(req,res)=>{const p=req.params.provider,c=oauth[p];if(!c?.client||!c.secret)return res.status(503).send('تسجيل الدخول ده محتاج إعداد مفاتيح المطور');
 const state=crypto.randomBytes(16).toString('hex');res.cookie('oauth_state',state,{httpOnly:true,sameSite:'lax',secure:BASE_URL.startsWith('https://'),maxAge:600000});
 const url=new URL(c.authorize);url.searchParams.set('client_id',c.client);url.searchParams.set('redirect_uri',BASE_URL+`/api/auth/${p}/callback`);url.searchParams.set('scope',c.scope);url.searchParams.set('state',state);url.searchParams.set('response_type','code');if(p==='google')url.searchParams.set('access_type','online');res.redirect(url.toString());});
app.get('/api/auth/:provider/callback',async(req,res)=>{const p=req.params.provider,c=oauth[p];const state=parseCookies(req.headers.cookie).oauth_state;
 if(!c?.client||!c.secret||!state||state!==req.query.state||!req.query.code)return res.redirect('/?autherror=1');
 res.clearCookie('oauth_state');try{
 const redirect_uri=BASE_URL+`/api/auth/${p}/callback`;
 const params=new URLSearchParams({client_id:c.client,client_secret:c.secret,code:String(req.query.code),redirect_uri,grant_type:'authorization_code'});
 const response=p==='google'?await fetch(c.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params}):null;
 const tokenResult=p==='facebook'?await (async()=>{const u=new URL(c.token);for(const [k,v] of params)u.searchParams.set(k,v);return (await fetch(u)).json();})():await response.json();
 if(!tokenResult.access_token)throw Error('OAuth failed');
 let profile;
 if(p==='google'){const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokenResult.access_token}});profile=await r.json();if(!profile.email_verified)throw Error('Unverified email');}
 else{const r=await fetch('https://graph.facebook.com/me?fields=id,name,email',{headers:{Authorization:'Bearer '+tokenResult.access_token}});profile=await r.json();}
 const pid=String(profile.sub||profile.id);if(!pid||pid==='undefined')throw Error('Missing id');
 const email=profile.email?String(profile.email).toLowerCase():null;
 let u=getByProvider(p,pid);if(!u && email)u=getByEmail(email);
 if(!u)u=createUser({email,name:safeName(profile.name)||'لاعب سيجا',provider:p,providerId:pid});else if(u.provider==='guest' || u.provider==='email')u=linkProvider(u.id,p,pid);
 setCookie(res,u.id);res.redirect('/');
 }catch(e){console.error('Social auth error:',e.message);res.redirect('/?autherror=1');}
});
app.get('/api/config',(req,res)=>res.json({providers:{google:!!(oauth.google.client&&oauth.google.secret),facebook:!!(oauth.facebook.client&&oauth.facebook.secret)},iceServers:JSON.parse(process.env.ICE_SERVERS_JSON||'[{"urls":"stun:stun.l.google.com:19302"}]'),items:storeItems}));
app.get('/api/me',(req,res)=>res.json({user:publicUser(fromCookie(req.headers.cookie))}));
app.patch('/api/me',auth,(req,res)=>{const patch={};if(req.body?.name)patch.name=safeName(req.body.name);
 if(['🦁','👑','🐪','🦅','🐈','🪷','👸','🧑','🧕','👨','👩'].includes(req.body?.avatar))patch.avatar=req.body.avatar;
 if(req.body?.settings&&typeof req.body.settings==='object')patch.settings={...req.user.settings,...req.body.settings};
 res.json({user:publicUser(updateUser(req.user.id,patch))});});
app.post('/api/daily',auth,(req,res)=>{if(Date.now()-req.user.daily_claim<20*3600000)return res.status(409).json({error:'استنى لحد هديتك الجاية'});
 const u=addWallet(req.user.id,{coins:450,gems:10,xp:35});updateUser(u.id,{daily_claim:Date.now()});res.json({user:publicUser(getUser(u.id)),reward:{coins:450,gems:10}});});
app.get('/api/store',(req,res)=>res.json({items:storeItems}));
app.post('/api/store/buy',auth,(req,res)=>{const item=storeItems.find(x=>x.id===req.body?.id);if(!item)return res.status(404).json({error:'المنتج غير موجود'});
 const u=getUser(req.user.id);if(u.inventory.includes(item.id))return res.status(409).json({error:'عندك الطقم ده بالفعل'});
 if(item.price>0&&!spend(u.id,item.currency,item.price))return res.status(400).json({error:'رصيدك مش كفاية'});
 return res.json({user:publicUser(updateUser(u.id,{inventory:[...u.inventory,item.id]}))});});
app.post('/api/store/equip',auth,(req,res)=>{const u=getUser(req.user.id);if(!u.inventory.includes(req.body?.id))return res.status(400).json({error:'لازم تشتري الطقم الأول'});res.json({user:publicUser(updateUser(u.id,{equipped:req.body.id}))});});
app.get('/api/leaderboard',(_req,res)=>res.json({users:leaderboards()}));
app.get('/api/users/search',auth,(req,res)=>res.json({users:searchUsers(safeText(req.query.q,22),req.user.id)}));
app.get('/api/friends',auth,(req,res)=>res.json({friends:listFriends(req.user.id).map(f=>({...f,user:publicUser(f.user)}))}));
app.post('/api/friends/request',auth,(req,res)=>res.json({ok:requestFriend(req.user.id,String(req.body?.id||''))}));
app.post('/api/friends/accept',auth,(req,res)=>res.json({ok:acceptFriend(req.user.id,String(req.body?.id||''))}));
app.get('/api/dm/:id',auth,(req,res)=>res.json({messages:dms(req.user.id,req.params.id)}));
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomId(){let v;do{v=Array.from({length:6},()=>chars[crypto.randomInt(chars.length)]).join('');}while(rooms.has(v));return v;}
function makeRoom(owner,kind='private',versusBot=false){const id=roomId(),r={id,kind,owner:owner.id,seats:[owner.id,versusBot?'bot':null],game:initialGame(),created:Date.now(),status:versusBot?'playing':'waiting',chats:[],paid:false,settled:false,voice:new Set()};rooms.set(id,r);return r;}
function roomSafe(r){return {id:r.id,kind:r.kind,status:r.status,owner:r.owner,players:r.seats.map(id=>id==='bot'?{id:'bot',name:'الروبوت رمسيس',avatar:'🤖',equipped:'gold'}:id?publicUser(getUser(id)):null),game:r.game,chat:r.chats.slice(-60),count:r.seats.filter(Boolean).length};}
function notify(r){io.to('room:'+r.id).emit('room:update',roomSafe(r));io.emit('lobby:update');}
function settle(r){if(r.settled||r.game.winner===null)return;r.settled=true;r.status='finished';
 for(let p=0;p<2;p++){const id=r.seats[p];if(!id||id==='bot')continue;
 const win=r.game.winner===p,draw=r.game.winner==='draw';
 const payout=r.paid?(win?500:draw?250:0):r.seats.includes('bot')?(win?60:draw?20:10):(win?150:draw?50:20);
 addWallet(id,{coins:payout,xp:win?90:draw?35:20,wins:win?1:0,losses:!win&&!draw?1:0,draws:draw?1:0});
 io.to('user:'+id).emit('wallet:update',publicUser(getUser(id)));
 }notify(r);
}
function doAi(r){if(r.status!=='playing'||r.game.winner!==null||r.seats[r.game.turn]!=='bot')return;
 setTimeout(()=>{if(r.status!=='playing'||r.seats[r.game.turn]!=='bot')return;const move=aiAction(r.game,r.game.turn);if(!move)return;
 const result=applyAction(r.game,r.game.turn,move);if(result.ok){r.game=result.game;notify(r);if(r.game.winner!==null)settle(r);else doAi(r);}},500);
}
function enter(r,u){if(r.seats.includes(u.id))return {ok:true};if(r.status!=='waiting'||r.seats.every(Boolean))return {ok:false,error:'الغرفة اكتملت أو بدأت'};
 if(r.kind==='vip'){if(getUser(r.owner).coins<250||u.coins<250)return {ok:false,error:'غرف VIP محتاجة ٢٥٠ كوين لكل لاعب'};if(!spend(r.owner,'coins',250))return {ok:false,error:'رصيد المضيف مش كفاية'};if(!spend(u.id,'coins',250)){addWallet(r.owner,{coins:250});return {ok:false,error:'رصيدك مش كفاية'};}r.paid=true;
 io.to('user:'+r.owner).emit('wallet:update',publicUser(getUser(r.owner)));io.to('user:'+u.id).emit('wallet:update',publicUser(getUser(u.id)));}
 r.seats[1]=u.id;r.status='playing';notify(r);return {ok:true};}
app.get('/api/rooms',(_req,res)=>res.json({rooms:[...rooms.values()].filter(r=>r.status==='waiting'&&r.kind!=='private').map(r=>({id:r.id,kind:r.kind,status:r.status,owner:publicUser(getUser(r.owner))})).slice(0,40)}));
app.post('/api/rooms',auth,(req,res)=>{const kind=['private','public','vip'].includes(req.body?.kind)?req.body.kind:'private';const r=makeRoom(req.user,kind,false);res.json({room:roomSafe(r)});notify(r);});
app.post('/api/bot',auth,(req,res)=>{const r=makeRoom(req.user,'bot',true);res.json({room:roomSafe(r)});notify(r);});
app.post('/api/quick',auth,(req,res)=>{while(queue.length){const id=queue.shift(),r=rooms.get(id);if(!r||r.status!=='waiting'||r.owner===req.user.id)continue;const result=enter(r,req.user);if(result.ok)return res.json({room:roomSafe(r)});}
 const r=makeRoom(req.user,'quick');queue.push(r.id);res.json({room:roomSafe(r)});notify(r);});
app.post('/api/rooms/:id/join',auth,(req,res)=>{const r=rooms.get(req.params.id.toUpperCase());if(!r)return res.status(404).json({error:'الغرفة غير موجودة'});
 const result=enter(r,req.user);if(!result.ok)return res.status(409).json(result);res.json({room:roomSafe(r)});});
app.get('/api/rooms/:id',auth,(req,res)=>{const r=rooms.get(req.params.id.toUpperCase());if(!r||!r.seats.includes(req.user.id))return res.status(404).json({error:'مش عضو في الغرفة'});res.json({room:roomSafe(r)});});
app.post('/api/rooms/:id/leave',auth,(req,res)=>{const r=rooms.get(req.params.id.toUpperCase());if(!r||!r.seats.includes(req.user.id))return res.json({ok:true});
 if(r.status==='playing'&&!r.settled){r.game.winner=other(r.seats.indexOf(req.user.id));settle(r);}
 if(r.status==='waiting')rooms.delete(r.id);res.json({ok:true});notify(r);
});
// Serve routes used for invitation links from the same HTML shell.
app.use(express.static(path.join(__dirname,'public')));
app.get(['/room/:id','/invite/:id'],(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/health',(_req,res)=>res.json({status:'ok',rooms:rooms.size}));
const lastMessage=new Map();
const chatAllowed=(id,key)=>{const k=id+':'+key,t=Date.now();if(t-(lastMessage.get(k)||0)<800)return false;lastMessage.set(k,t);return true;};
io.use((socket,next)=>{const user=fromCookie(socket.handshake.headers.cookie);if(!user)return next(new Error('سجل دخول الأول'));socket.data.uid=user.id;next();});
io.on('connection',socket=>{const uid=socket.data.uid;socket.join('user:'+uid);
 socket.on('room:subscribe',({id},ack=()=>{})=>{const r=rooms.get(String(id).toUpperCase());if(!r||!r.seats.includes(uid))return ack({error:'مش عضو في الغرفة'});socket.join('room:'+r.id);ack({room:roomSafe(r)});});
 socket.on('game:action',({id,action},ack=()=>{})=>{const r=rooms.get(String(id).toUpperCase());if(!r||r.status!=='playing')return ack({error:'اللعبة مش شغالة'});
 const p=r.seats.indexOf(uid);if(p<0)return ack({error:'مش عضو في الغرفة'});
 const v=applyAction(r.game,p,action);if(!v.ok)return ack({error:v.error});r.game=v.game;ack({ok:true});notify(r);if(r.game.winner!==null)settle(r);else doAi(r);
 });
 socket.on('chat:send',({id,text},ack=()=>{})=>{const r=rooms.get(String(id).toUpperCase());if(!r||!r.seats.includes(uid))return ack({error:'مش عضو'});
 const body=safeText(text,200);if(!body||!chatAllowed(uid,'room'))return ack({error:'استنى لحظة'});
 const u=getUser(uid),m={id:crypto.randomUUID(),uid,name:u.name,avatar:u.avatar,text:body,at:Date.now()};r.chats.push(m);r.chats=r.chats.slice(-60);io.to('room:'+r.id).emit('chat:new',m);ack({ok:true});});
 socket.on('world:send',({text},ack=()=>{})=>{const body=safeText(text,150);if(!body||!chatAllowed(uid,'world'))return ack({error:'استنى لحظة'});
 const u=getUser(uid),m={uid,name:u.name,avatar:u.avatar,text:body,at:Date.now()};io.emit('world:new',m);ack({ok:true});});
 socket.on('dm:send',({to,text},ack=()=>{})=>{const body=safeText(text,500);if(!getUser(to)||!body||!chatAllowed(uid,'dm'))return ack({error:'الرسالة ما اتبعتتش'});
 const m=sendDm(uid,to,body);io.to('user:'+uid).to('user:'+to).emit('dm:new',m);ack({ok:true});});
 socket.on('voice:join',({id},ack=()=>{})=>{const r=rooms.get(String(id).toUpperCase());if(!r||!r.seats.includes(uid)||r.status!=='playing'||r.seats.includes('bot'))return ack({error:'الصوت للغرف الثنائية الحقيقية فقط'});
 r.voice.add(uid);socket.join('voice:'+r.id);socket.to('voice:'+r.id).emit('voice:peer-joined',{uid});ack({peers:[...r.voice].filter(x=>x!==uid)});});
 socket.on('voice:signal',({id,to,data},ack=()=>{})=>{const r=rooms.get(String(id).toUpperCase());if(!r||!r.seats.includes(uid)||!r.seats.includes(to)||!r.voice.has(uid)||!r.voice.has(to))return ack({error:'مش مسموح'});
 if(JSON.stringify(data).length>12000)return ack({error:'حجم الإشارة كبير'});io.to('user:'+to).emit('voice:signal',{id:r.id,from:uid,data});ack({ok:true});});
 socket.on('voice:leave',({id})=>{const r=rooms.get(String(id).toUpperCase());if(!r)return;r.voice.delete(uid);socket.leave('voice:'+r.id);socket.to('voice:'+r.id).emit('voice:peer-left',{uid});});
 socket.on('disconnect',()=>{for(const r of rooms.values())if(r.voice.delete(uid))socket.to('voice:'+r.id).emit('voice:peer-left',{uid});});
});
setInterval(()=>{const limit=Date.now()-12*3600000;for(const [id,r] of rooms)if(r.created<limit){rooms.delete(id);}},3600000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Seega Royale listening on ${PORT}`));