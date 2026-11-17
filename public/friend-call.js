// Opt-in friend-to-friend voice calls. Firestore signals consent; PeerJS carries audio.
// This does not create background calls or request microphone permission automatically.
import {firebaseSdk} from './firebase-auth.js?v=11.3';
let context=null,stopIncoming=null,stopInbox=null,session=null;
let incomingHandler=()=>{},changeHandler=()=>{},noticeHandler=()=>{};
const seen=new Set(),pending=new Map();
const callCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');
const friendly=e=>{
 if(e?.code==='permission-denied'||/Missing or insufficient permissions/i.test(String(e?.message||'')))
  return 'Firebase رفض الاتصال لأن قواعد مكالمات الأصدقاء لم تُنشر. افتح Firebase → Firestore Database → Rules وانشر أحدث ملف firestore.rules من GitHub.';
 if(e?.name==='NotAllowedError')return 'اسمح للعبة باستخدام الميكروفون من إعدادات Chrome.';
 return String(e?.message||'تعذر الاتصال الصوتي');
};
const pair=(a,b)=>[a,b].sort().join('__');
function update(){changeHandler(session?{active:true,id:session.id,name:session.name,status:session.status,muted:session.muted}:null);}
function stopAudio(){const el=document.getElementById('seega-friend-audio');if(el){el.srcObject=null;el.remove();}}
export function friendPlayAudio(){const el=document.getElementById('seega-friend-audio');return el?.play();}
function remoteAudio(stream){
 if(session?.timer){clearTimeout(session.timer);session.timer=null;}
 let audio=document.getElementById('seega-friend-audio');
 if(!audio){audio=document.createElement('audio');audio.id='seega-friend-audio';audio.autoplay=true;audio.playsInline=true;document.body.append(audio);}
 audio.srcObject=stream;
 audio.play().catch(()=>noticeHandler('🔊 اضغط تشغيل الصوت في شريط المكالمة لو المتصفح منعه.'));
 if(session){session.status='connected';update();}
}
function cleanLocal(){
 const current=session;session=null;
 if(!current){update();return;}
 if(current.timer)clearTimeout(current.timer);
 try{current.unsubscribe?.();}catch{}
 try{current.mediaCall?.close();}catch{}
 try{current.peer?.destroy();}catch{}
 for(const track of current.stream?.getTracks?.()||[])track.stop();
 stopAudio();update();
}
async function env(){if(context)return context;
 const {auth}=await firebaseSdk();await auth.authStateReady?.();
 if(!auth.currentUser)throw Error('سجل دخول بحساب Firebase علشان تتصل بصاحبك');
 const fs=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
 const {getApp}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js');
 context={auth,fs,db:fs.getFirestore(getApp())};return context;
}
let loadingPeer=null;
async function peerJs(){
 if(typeof window.Peer==='function')return;
 if(!loadingPeer)loadingPeer=(async()=>{
  for(const url of ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js']){
   try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.async=true;const timer=setTimeout(()=>reject(Error('timeout')),10000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('CDN unavailable'));};document.head.append(script);});if(window.Peer)return;}catch{}
  }
  throw Error('خدمة الاتصال الصوتي مش متاحة دلوقتي');
 })().finally(()=>{loadingPeer=null;});
 return loadingPeer;
}
function peerOpen(peer){
 return new Promise((resolve,reject)=>{let finished=false;
  const timer=setTimeout(()=>{if(!finished){finished=true;reject(Error('انتهت مهلة الاتصال الصوتي'));}},15000);
  peer.on('open',id=>{if(!finished){finished=true;clearTimeout(timer);resolve(id);}});
  peer.on('error',e=>{if(!finished){finished=true;clearTimeout(timer);reject(e);}});
 });
}
async function mic(){
 if(!navigator.mediaDevices?.getUserMedia)throw Error('المتصفح لا يدعم الميكروفون أو الرابط غير آمن');
 try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});}
 catch(e){throw Error(friendly(e));}
}
// Compatibility signaling through friend-only inbox notices uses the same secure
// accepted-friend path as direct chat. Needed for deployed projects with older
// Firestore rules that reject friendCalls collection access.
const SIGNAL_PREFIX='VOICE_V1|';
async function sendInboxSignal(otherUid,kind,id,peerId=''){
 const {auth,fs,db}=await env(),sender=auth.currentUser.uid;
 const pairId=pair(sender,otherUid),friend=await fs.getDoc(fs.doc(db,'friendRequests',pairId));
 if(!friend.exists()||friend.data().status!=='accepted')throw Error('المكالمة متاحة للأصدقاء المقبولين فقط');
 const text=[SIGNAL_PREFIX.slice(0,-1),kind,id,peerId].filter(Boolean).join('|');
 if(text.length>160)throw Error('إشارة الاتصال طويلة جدًا');
 await fs.addDoc(fs.collection(db,'inbox',otherUid,'items'),{
  fromUid:sender,kind:'notice',text,roomCode:'',read:false,at:fs.serverTimestamp(),pairId
 });
}
async function handleInboxSignal(data){
 const bits=String(data.text||'').split('|');
 if(bits[0]!=='VOICE_V1'||!['CALL','ACCEPT','DECLINE','END'].includes(bits[1]))return;
 const [prefix,kind,id,peerId]=bits;
 if(!/^[A-Za-z0-9]{10,100}$/.test(id))return;
 const {fs,db,auth}=await env(),otherUid=data.fromUid;
 if(!otherUid||otherUid===auth.currentUser.uid)return;
 if(kind==='CALL'){
  if(!/^[A-Za-z0-9-]{10,128}$/.test(peerId||''))return;
  if(session||seen.has(id))return;
  const friend=await fs.getDoc(fs.doc(db,'friendRequests',pair(auth.currentUser.uid,otherUid)));
  if(!friend.exists()||friend.data().status!=='accepted')return;
  seen.add(id);pending.set(id,{id,fromUid:otherUid,peerId,transport:'inbox'});
  incomingHandler({id,uid:otherUid});
  return;
 }
 if(!session||session.id!==id||session.otherUid!==otherUid||session.transport!=='inbox')return;
 if(kind==='ACCEPT'&&session.role==='caller'&&session.status==='ringing'){
  session.status='connecting';session.stream?.getAudioTracks().forEach(t=>t.enabled=!session.muted);update();
 }else if(kind==='DECLINE'||kind==='END'){
  noticeHandler(kind==='DECLINE'?'الصديق رفض المكالمة':'المكالمة انتهت');
  cleanLocal();
 }
}
function watchInboxSignals(db,fs,uid){
 const q=fs.query(fs.collection(db,'inbox',uid,'items'),fs.orderBy('at','desc'),fs.limit(80));
 return fs.onSnapshot(q,snap=>{
  for(const change of snap.docChanges()){
   const doc=change.doc,data=doc.data();
   if(!String(data.text||'').startsWith(SIGNAL_PREFIX)||data.kind!=='notice')continue;
   const age=Date.now()-(data.at?.toMillis?.()||0);
   if(age<0||age>90000||change.type!=='added')continue;
   handleInboxSignal(data).catch(()=>{});
   // Recipient owns their inbox; remove transient control messages to avoid
   // unread counts, stale call prompts, and unbounded signaling documents.
   fs.deleteDoc(fs.doc(db,'inbox',uid,'items',doc.id)).catch(()=>{});
  }
 },e=>noticeHandler('إشعارات المكالمة غير متاحة: '+friendly(e)));
}
function watchActiveCall(ref,id){
 const {fs}=context;
 return fs.onSnapshot(ref,snap=>{
  if(!session||session.id!==id)return;
  if(!snap.exists()){noticeHandler('المكالمة لم تعد متاحة');cleanLocal();return;}
  const status=snap.data().state;
  if(status==='declined'||status==='ended'){noticeHandler(status==='declined'?'الصديق رفض المكالمة':'المكالمة انتهت');cleanLocal();return;}
  if(status==='accepted'&&session.role==='caller'&&session.status==='ringing'){
   session.status='connecting';session.stream?.getAudioTracks().forEach(t=>t.enabled=true);update();
  }
 },e=>noticeHandler('تعذر متابعة المكالمة: '+friendly(e)));
}
export async function friendCallsStart(handlers){
 await friendCallsStop();
 incomingHandler=handlers.onIncoming||(()=>{});changeHandler=handlers.onChange||(()=>{});noticeHandler=handlers.onNotice||(()=>{});
 const {auth,fs,db}=await env(),uid=auth.currentUser.uid;
 pending.clear();seen.clear();
 // Existing Firebase installations may grant inbox access but not friendCalls.
 // In that case the fallback still receives and accepts real audio requests.
 stopInbox=watchInboxSignals(db,fs,uid);
 const q=fs.query(fs.collection(db,'friendCalls'),fs.where('toUid','==',uid));
 stopIncoming=fs.onSnapshot(q,snap=>{
  for(const d of snap.docs){
   const v=d.data(),age=Date.now()-(v.createdAt?.toMillis?.()||0);
   if(v.state!=='ringing'||age<0||age>90000||seen.has(d.id)||session)continue;
   seen.add(d.id);pending.set(d.id,{id:d.id,...v,transport:'rules'});
   incomingHandler({id:d.id,uid:v.fromUid});
  }
 },e=>{
  if(e?.code!=='permission-denied')noticeHandler('تعذر متابعة إشعارات المكالمات: '+friendly(e));
 });
}
export async function friendCallsStop(){
 try{stopIncoming?.();}catch{}stopIncoming=null;
 try{stopInbox?.();}catch{}stopInbox=null;
 if(session)await friendCallHangup();
 pending.clear();context=null;seen.clear();
}
export async function friendCallDial(otherUid,name){
 if(session)throw Error('اقفل المكالمة الحالية الأول');
 const {auth,fs,db}=await env();
 if(!otherUid||otherUid===auth.currentUser.uid)throw Error('اختار صديق تاني');
 const pairId=pair(auth.currentUser.uid,otherUid);
 const friend=await fs.getDoc(fs.doc(db,'friendRequests',pairId));
 if(!friend.exists()||friend.data().status!=='accepted')throw Error('المكالمة متاحة للأصدقاء المقبولين فقط');
 await peerJs();
 const stream=await mic();stream.getAudioTracks().forEach(t=>t.enabled=false);
 const peerId='seegaroyal-voice-'+callCode(),peer=new window.Peer(peerId,{debug:0});
 try{await peerOpen(peer);}catch(e){stream.getTracks().forEach(t=>t.stop());peer.destroy();throw Error(friendly(e));}
 const docRef=fs.doc(fs.collection(db,'friendCalls'));
 const current={id:docRef.id,ref:docRef,role:'caller',status:'ringing',name,stream,peer,mediaCall:null,muted:false,unsubscribe:null,timer:null,transport:'rules',otherUid};
 session=current;update();
 peer.on('error',e=>{if(session===current){noticeHandler('الصوت: '+friendly(e));friendCallHangup().catch(()=>{});}});
 peer.on('call',call=>{
  if(session!==current||call.metadata?.callId!==current.id){call.close();return;}
  current.mediaCall=call;
  current.stream.getAudioTracks().forEach(t=>t.enabled=!current.muted);
  call.answer(current.stream);current.status='connecting';update();
  current.timer=setTimeout(()=>{if(session===current&&current.status!=='connected'){noticeHandler('الصوت ما اتوصلش؛ جرّب شبكة ثانية أو إعداد TURN');friendCallHangup().catch(()=>{});}},25000);
  call.on('stream',remoteAudio);
  call.on('close',()=>{if(session===current)friendCallHangup().catch(()=>{});});
  call.on('error',e=>noticeHandler('تعذر نقل الصوت: '+friendly(e)));
 });
 try{
  await fs.setDoc(docRef,{fromUid:auth.currentUser.uid,toUid:otherUid,pairId,peerId,state:'ringing',createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
  current.unsubscribe=watchActiveCall(docRef,current.id);
 }catch(e){
  if(e?.code==='permission-denied'||/permission/i.test(String(e?.message||''))){
   try{
    await sendInboxSignal(otherUid,'CALL',current.id,peerId);
    current.transport='inbox';return current.id;
   }catch(fallbackError){cleanLocal();throw Error('تعذر الاتصال حتى عبر إشعارات الأصدقاء: '+friendly(fallbackError));}
  }
  cleanLocal();throw Error('تعذر إرسال طلب المكالمة: '+friendly(e));
 }
 return current.id;
}
export async function friendCallAnswer(id,name){
 if(session)throw Error('في مكالمة شغالة بالفعل');
 const request=pending.get(id);if(!request)throw Error('طلب المكالمة مش موجود أو انتهى');
 const {auth,fs,db}=await env(),isInbox=request.transport==='inbox';
 const ref=isInbox?null:fs.doc(db,'friendCalls',id);
 const snap=isInbox?null:await fs.getDoc(ref);
 if(!isInbox&&(!snap.exists()||snap.data().toUid!==auth.currentUser.uid||snap.data().state!=='ringing'))throw Error('المكالمة انتهت');
 const remote=isInbox?request:snap.data(),otherUid=remote.fromUid;
 const friend=await fs.getDoc(fs.doc(db,'friendRequests',pair(auth.currentUser.uid,otherUid)));
 if(!friend.exists()||friend.data().status!=='accepted')throw Error('اتصال الأصدقاء يحتاج صداقة مقبولة');
 await peerJs();
 const stream=await mic();const peer=new window.Peer(undefined,{debug:0});
 try{await peerOpen(peer);}catch(e){stream.getTracks().forEach(t=>t.stop());peer.destroy();throw Error(friendly(e));}
 const current={id,ref,role:'receiver',status:'connecting',name,stream,peer,mediaCall:null,muted:false,unsubscribe:null,timer:null,transport:request.transport,otherUid};
 session=current;update();
 try{
  if(isInbox)await sendInboxSignal(otherUid,'ACCEPT',id);
  else {
   await fs.updateDoc(ref,{state:'accepted',updatedAt:fs.serverTimestamp()});
   current.unsubscribe=watchActiveCall(ref,id);
  }
  peer.on('error',e=>{if(session===current){noticeHandler('الصوت: '+friendly(e));friendCallHangup().catch(()=>{});}});
  const call=peer.call(remote.peerId,stream,{metadata:{callId:id}});if(!call)throw Error('تعذر ربط الصوت');
  current.mediaCall=call;
  current.timer=setTimeout(()=>{if(session===current&&current.status!=='connected'){noticeHandler('تعذر اتصال الصوت بعد الموافقة؛ جرّب شبكة مختلفة أو TURN');friendCallHangup().catch(()=>{});}},25000);
  call.on('stream',remoteAudio);
  call.on('close',()=>{if(session===current)friendCallHangup().catch(()=>{});});
  call.on('error',e=>noticeHandler('تعذر نقل الصوت: '+friendly(e)));
  pending.delete(id);
 }catch(e){await friendCallHangup();throw Error('تعذر قبول المكالمة: '+friendly(e));}
}
export async function friendCallDecline(id){
 const request=pending.get(id);pending.delete(id);if(!request)return;
 const {fs,db}=await env();
 if(request.transport==='inbox')await sendInboxSignal(request.fromUid,'DECLINE',id);
 else await fs.updateDoc(fs.doc(db,'friendCalls',id),{state:'declined',updatedAt:fs.serverTimestamp()});
}
export function friendCallMute(){
 if(!session?.stream||!['connected','connecting'].includes(session.status))return false;
 session.muted=!session.muted;
 session.stream.getAudioTracks().forEach(t=>t.enabled=!session.muted);update();
 return session.muted;
}
export async function friendCallHangup(){
 if(!session)return;
 const {ref,transport,otherUid,id}=session,{fs}=context||{};
 cleanLocal();
 if(transport==='inbox'&&otherUid)await sendInboxSignal(otherUid,'END',id).catch(()=>{});
 else if(ref&&fs)await fs.updateDoc(ref,{state:'ended',updatedAt:fs.serverTimestamp()}).catch(()=>{});
}
