// Realtime social service. Activated ONLY with a real Firebase project, Authentication and Firestore rules.
// Guests continue to play locally; no fake online users, friends, messages, or presence.
import {firebaseSdk,firebaseReady} from './firebase-auth.js';
export const cloudSocialAvailable=()=>firebaseReady();
let publicName='لاعب سيجا',ctx=null,stopFns=[],presenceWatchers=new Map(),heartbeat=null,currentRoom=()=>null,onUpdate=()=>{},onNotice=()=>{},userId=null;
const sanitize=x=>String(x??'').trim();
const cleanName=n=>sanitize(n).slice(0,24)||'لاعب سيجا';
const cleanRoom=s=>/^[A-Z0-9]{6}$/.test(String(s||'').toUpperCase())?String(s).toUpperCase():'';
const validID=s=>/^SG-[A-F0-9]{10}$/.test(String(s||'').toUpperCase());
const rawPhoto=x=>typeof x==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x)&&x.length<170000?x:null;
const tm=x=>x?.toMillis?.()||0;
const info={friends:[],requests:[],publicChat:[],inbox:[],dm:[],dmOther:null,online:false};
function push(){onUpdate({...info, friends:info.friends.map(x=>({...x})),requests:[...info.requests],publicChat:[...info.publicChat],inbox:[...info.inbox],dm:[...info.dm]});}
async function init(){if(ctx)return ctx;if(!firebaseReady())throw Error('المشروع مش مربوط بـ Firebase');
 const {auth}=await firebaseSdk();await auth.authStateReady?.();if(!auth.currentUser?.uid)throw Error('سجّل بحساب حقيقي علشان تستخدم الأصدقاء والشات');
 const fs=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
 const {getApp}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js');
 ctx={auth,fs,db:fs.getFirestore(getApp())};userId=auth.currentUser.uid;return ctx;
}
function idForFriend(a,b){return [a,b].sort().join('__');}
function subscribe(q,fn){const {fs}=ctx;const stop=fs.onSnapshot(q,fn,e=>onNotice({kind:'error',text:'مزامنة الحساب: '+String(e.code||e.message)}));stopFns.push(stop);return stop;}
async function refreshFriends(){const {fs,db}=ctx;
 const snapshots=await Promise.all([fs.getDocs(fs.query(fs.collection(db,'friendRequests'),fs.where('fromUid','==',userId))),fs.getDocs(fs.query(fs.collection(db,'friendRequests'),fs.where('toUid','==',userId)))]);
 const requests=[...new Map(snapshots.flatMap(s=>s.docs).map(d=>[d.id,{pairId:d.id,...d.data()}])).values()];info.requests=await Promise.all(requests.filter(x=>x.status==='pending'&&x.toUid===userId).map(async x=>{
  const d=await fs.getDoc(fs.doc(db,'directory',x.fromUid));const data=d.exists()?d.data():{};
  return {...x,user:{name:data.name||'لاعب سيجا',avatar:data.avatar||'🎮',photo:rawPhoto(data.photo),id:data.id||''}};
 }));
 const accepted=requests.filter(x=>x.status==='accepted');
 const friends=await Promise.all(accepted.map(async x=>{
  const uid=x.fromUid===userId?x.toUid:x.fromUid;
  const [pub,presence]=await Promise.all([fs.getDoc(fs.doc(db,'directory',uid)),fs.getDoc(fs.doc(db,'presence',uid))]);
  const profile=pub.exists()?pub.data():{id:'',name:'لاعب'};
  const pr=presence.exists()?presence.data():{};
  const isOnline=Date.now()-tm(pr.lastSeen)<125000;
  return {uid,pairId:x.pairId,user:{id:profile.id||'',name:profile.name||'لاعب',avatar:profile.avatar||'🎮',photo:rawPhoto(profile.photo)},online:isOnline,status:isOnline?pr.status||'online':'offline',roomCode:isOnline?cleanRoom(pr.roomCode):'',watchAllowed:isOnline&&pr.watchAllowed===true};
 }));
 info.friends=friends;
 for(const old of [...presenceWatchers.keys()])if(!friends.some(f=>f.uid===old)){presenceWatchers.get(old)();presenceWatchers.delete(old);}
 for(const f of friends)if(!presenceWatchers.has(f.uid)){
  const unsub=fs.onSnapshot(fs.doc(db,'presence',f.uid),snap=>{
   const pr=snap.exists()?snap.data():{},online=Date.now()-tm(pr.lastSeen)<125000;
   const current=info.friends.find(x=>x.uid===f.uid);if(!current)return;
   current.online=online;current.status=online?pr.status||'online':'offline';current.roomCode=online?cleanRoom(pr.roomCode):'';
   current.watchAllowed=online&&pr.watchAllowed===true;push();
  },()=>{});presenceWatchers.set(f.uid,unsub);
 }
 push();
}
function presentUser(){const r=currentRoom();return {status:r?.watchOnly?'watching':r?.kind==='online'&&r?.status==='playing'?'playing':'online',roomCode:r?.kind==='online'?cleanRoom(r.id):'',watchAllowed:r?.kind==='online'&&r.allowSpectators===true};}
export async function cloudPresence(){if(!ctx||!userId)return false;
 const {fs,db}=ctx;const obj=presentUser();
 await fs.setDoc(fs.doc(db,'presence',userId),{uid:userId,...obj,lastSeen:fs.serverTimestamp()},{merge:true});return true;
}
export async function cloudPublicProfile(local){const {auth,fs,db}=await init();const uid=auth.currentUser.uid;
 publicName=cleanName(local.name);const publicData={uid,id:validID(local.id)?local.id:'',name:publicName,avatar:sanitize(local.avatar).slice(0,8)||'🎮',photo:rawPhoto(local.photo),updatedAt:fs.serverTimestamp()};
 await fs.setDoc(fs.doc(db,'directory',uid),publicData,{merge:true});
 // Email discovery is opt-in to a verified email; unverified emails cannot claim somebody else's identity.
 const email=auth.currentUser.email?.trim().toLowerCase();
 if(email&&auth.currentUser.emailVerified&&email.length<160)await fs.setDoc(fs.doc(db,'emailIndex',email),{uid,id:publicData.id,name:publicData.name},{merge:true});
}
export async function cloudSocialStart(profile,roomGetter,update,notify){
 if(!firebaseReady())return false;
 await cloudSocialStop();currentRoom=roomGetter;onUpdate=update;onNotice=notify;
 const {fs,db}=await init();
 await cloudPublicProfile(profile);
 info.online=true;push();await cloudPresence();
 const q1=fs.query(fs.collection(db,'friendRequests'),fs.where('fromUid','==',userId));
 const q2=fs.query(fs.collection(db,'friendRequests'),fs.where('toUid','==',userId));
 subscribe(q1,()=>refreshFriends().catch(e=>onNotice({kind:'error',text:e.message})));
 subscribe(q2,()=>refreshFriends().catch(e=>onNotice({kind:'error',text:e.message})));
 subscribe(fs.query(fs.collection(db,'publicChat'),fs.orderBy('at','desc'),fs.limit(60)),snap=>{
  info.publicChat=snap.docs.map(d=>({id:d.id,...d.data(),at:tm(d.data().at),uid:d.data().uid})).reverse();push();
 });
 const startup=Date.now(),seen=new Set();
 subscribe(fs.query(fs.collection(db,'inbox',userId,'items'),fs.orderBy('at','desc'),fs.limit(40)),snap=>{
  info.inbox=snap.docs.map(d=>({id:d.id,...d.data(),at:tm(d.data().at)}));push();
  for(const change of snap.docChanges()){
   const data=change.doc.data(),at=tm(data.at),id=change.doc.id;
   if(change.type==='added'&&!data.read&&at>=startup-8000&&!seen.has(id)){
    seen.add(id);onNotice({kind:data.kind||'invite',text:data.text||'وصلك إشعار جديد',roomCode:cleanRoom(data.roomCode),id});
   }
  }
 });
 heartbeat=setInterval(()=>cloudPresence().catch(()=>{}),50000);
 return true;
}
export async function cloudSocialStop(){
 if(heartbeat)clearInterval(heartbeat);heartbeat=null;for(const f of stopFns.splice(0))try{f();}catch{}for(const f of presenceWatchers.values())try{f();}catch{}presenceWatchers.clear();
 if(ctx&&userId){const {fs,db}=ctx;await fs.setDoc(fs.doc(db,'presence',userId),{status:'offline',roomCode:'',watchAllowed:false,lastSeen:fs.serverTimestamp()},{merge:true}).catch(()=>{});}
 ctx=null;userId=null;info.online=false;info.friends=[];info.requests=[];info.dm=[];info.publicChat=[];info.inbox=[];
}
export async function cloudSearchPlayer(s){const {fs,db}=await init();const term=sanitize(s);let doc=null;
 if(validID(term)){
  const res=await fs.getDocs(fs.query(fs.collection(db,'directory'),fs.where('id','==',term.toUpperCase()),fs.limit(1)));
  doc=res.docs[0];
 }else if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)){
  const idx=await fs.getDoc(fs.doc(db,'emailIndex',term.toLowerCase()));
  if(idx.exists())doc=await fs.getDoc(fs.doc(db,'directory',idx.data().uid));
 }else throw Error('اكتب ID بالشكل SG-XXXXXXXXXX أو إيميل صحيح');
 if(!doc?.exists?.())throw Error('مفيش حساب مؤكد بنفس الـ ID أو الإيميل');
 if(doc.id===userId)throw Error('ده حسابك إنت');
 const v=doc.data();return {uid:doc.id,user:{id:v.id,name:v.name,avatar:v.avatar,photo:rawPhoto(v.photo)}};
}
export async function cloudSendFriendRequest(otherUid){const {fs,db}=await init();if(!otherUid||otherUid===userId)throw Error('اختار حساب صاحبك');
 const id=idForFriend(userId,otherUid),ref=fs.doc(db,'friendRequests',id),old=await fs.getDoc(ref);
 if(old.exists())throw Error(old.data().status==='accepted'?'أنتوا أصحاب بالفعل':'طلب الصداقة موجود بالفعل');
 await fs.setDoc(ref,{fromUid:userId,toUid:otherUid,status:'pending',at:fs.serverTimestamp()});
 return true;
}
export async function cloudRespondFriend(pairId,accept){const {fs,db}=await init();
 const ref=fs.doc(db,'friendRequests',pairId),snap=await fs.getDoc(ref);
 if(!snap.exists()||snap.data().toUid!==userId||snap.data().status!=='pending')throw Error('الطلب غير موجود');
 await fs.updateDoc(ref,{status:accept?'accepted':'rejected'});
 return true;
}
export async function cloudSendInbox(uid,kind,text,roomCode=''){
 const {fs,db}=await init();const pairId=idForFriend(userId,uid),friend=await fs.getDoc(fs.doc(db,'friendRequests',pairId));
 if(!friend.exists()||friend.data().status!=='accepted')throw Error('الإشعارات والدعوات متاحة للأصدقاء فقط');
 await fs.addDoc(fs.collection(db,'inbox',uid,'items'),{fromUid:userId,kind,text:sanitize(text).slice(0,160),roomCode:cleanRoom(roomCode),read:false,at:fs.serverTimestamp(),pairId});
}
export async function cloudMarkInbox(id){const {fs,db}=await init();await fs.updateDoc(fs.doc(db,'inbox',userId,'items',id),{read:true});}
export async function cloudSendDirect(otherUid,text){const {fs,db}=await init();const clean=sanitize(text).slice(0,200);if(!clean)throw Error('اكتب رسالة');
 const pairId=idForFriend(userId,otherUid),friend=await fs.getDoc(fs.doc(db,'friendRequests',pairId));
 if(!friend.exists()||friend.data().status!=='accepted')throw Error('مش موجود في قائمة أصدقائك');
 await fs.addDoc(fs.collection(db,'dmThreads',pairId,'messages'),{uid:userId,text:clean,at:fs.serverTimestamp()});
 await cloudSendInbox(otherUid,'dm','💬 وصلت لك رسالة جديدة');
}
export function cloudWatchDirect(otherUid){if(!ctx||!userId)return;
 const {fs,db}=ctx;for(const f of stopFns.filter(x=>x.__dm))try{f();}catch{}
 const pair=idForFriend(userId,otherUid);
 const unsub=fs.onSnapshot(fs.query(fs.collection(db,'dmThreads',pair,'messages'),fs.orderBy('at','desc'),fs.limit(60)),snap=>{
  info.dm=snap.docs.map(d=>({id:d.id,...d.data(),at:tm(d.data().at)})).reverse();info.dmOther=otherUid;push();
 },err=>onNotice({kind:'error',text:err.message}));
 unsub.__dm=true;stopFns.push(unsub);
}
export async function cloudPostPublic(text,roomCode=''){const {fs,db}=await init();const clean=sanitize(text).slice(0,180),code=cleanRoom(roomCode);
 if(!clean||clean.length>180)throw Error('اكتب رسالة قصيرة');
 await fs.addDoc(fs.collection(db,'publicChat'),{uid:userId,kind:code?'invite':'text',name:publicName,text:clean,roomCode:code,at:fs.serverTimestamp()});
}