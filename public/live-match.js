/**
 * Seega Royale / authenticated matchflow client (STAGING).
 * Existing bot/local/P2P gameplay is left untouched until QA is complete.
 * Never trust browser game state, opponent identity or localStorage balances.
 */
import {firebaseSdk} from './firebase-auth.js?v=11.4';

let session=null;
const getSdk=async()=>{
 const {auth}=await firebaseSdk();
 await auth.authStateReady?.();
 const uid=auth.currentUser?.uid;
 if(!uid)throw Error('المباريات الأونلاين تحتاج حساب Firebase حقيقي');
 if(!session||session.uid!==uid){
  const [apps,functions,fs]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.5.0/firebase-functions.js'),
   import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js')
  ]);
  const app=apps.getApp();
  session={uid,functions,fs,func:functions.getFunctions(app,'europe-west1'),db:fs.getFirestore(app)};
 }
 return session;
};
export async function liveUid(){return (await getSdk()).uid;}
export async function liveCall(name,body={}){
 const s=await getSdk();
 const names=new Set(['openSeegaQuick','openSeegaPrivate','resumeSeegaMatch','commandSeegaMatch','readSeegaWallet','postSeegaChat','signalSeegaVoice']);
 if(!names.has(name))throw Error('Unapproved game command');
 try{
  const answer=await s.functions.httpsCallable(s.func,name,{timeout:30000})(body);
  return answer.data;
 }catch(error){
  if(error?.code==='functions/not-found'||error?.code==='functions/unavailable')
   throw Error('خادم المباراة الآمن لم يُنشر بعد على Firebase. مفيش خصم فلوس من الجهاز.');
  if(error?.code==='functions/unauthenticated')
   throw Error('سجّل دخول من جديد بحساب Firebase حقيقي');
  throw Error(error?.message||'فشل اتصال خادم المباراة');
 }
}
export const liveOpenQuick=(mode,stakeMinor)=>liveCall('openSeegaQuick',{mode,stakeMinor});
export const liveOpenPrivate=mode=>liveCall('openSeegaPrivate',{mode});
export const liveResume=()=>liveCall('resumeSeegaMatch');
export const liveWallet=()=>liveCall('readSeegaWallet');
export const liveCommand=(matchId,type,extra={})=>liveCall('commandSeegaMatch',{
 matchId,
 command:{type,id:crypto.randomUUID(),...extra}
});
export const liveChat=(matchId,text)=>liveCall('postSeegaChat',{matchId,text});
export const liveSignal=(matchId,toUid,payload)=>liveCall('signalSeegaVoice',{matchId,toUid,payload});

const noop=()=>{};
export async function liveWatchMatch(matchId,{onMatch=noop,onChat=noop,onSignal=noop,onError=noop}={}){
 const s=await getSdk(),{fs,db,uid}=s;
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(String(matchId)))throw Error('كود المباراة غير صحيح');
 const unsubs=[];
 unsubs.push(fs.onSnapshot(fs.doc(db,'gameMatches',matchId),snap=>{
  if(!snap.exists()){onError(Error('المباراة لم تعد متاحة'));return;}
  const match=snap.data();
  if(!match.players?.some(p=>p?.uid===uid)){onError(Error('ليس لك تصريح في هذه المباراة'));return;}
  onMatch(match);
 },onError));
 unsubs.push(fs.onSnapshot(fs.query(fs.collection(db,'gameMatches',matchId,'chat'),fs.orderBy('at','asc'),fs.limitToLast(60)),snap=>{
  onChat(snap.docs.map(d=>({id:d.id,...d.data(),at:d.data().at?.toMillis?.()||0})));
 },onError));
 unsubs.push(fs.onSnapshot(fs.query(fs.collection(db,'gameMatches',matchId,'signals'),fs.where('toUid','==',uid),fs.limit(60)),snap=>{
  for(const change of snap.docChanges())if(change.type==='added')onSignal({id:change.doc.id,...change.doc.data()});
 },onError));
 return ()=>{for(const off of unsubs)try{off();}catch{}};
}
export async function liveWatchInvitations({onInvitation=noop,onError=noop}={}){
 const s=await getSdk(),{fs,db,uid}=s;
 const q=fs.query(fs.collection(db,'gameInvitations'),fs.where('toUid','==',uid));
 const seen=new Map();
 const stop=fs.onSnapshot(q,snap=>{
  const pending=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='pending'&&x.expiresAt>Date.now());
  for(const item of pending){
   const key=String(item.createdAt||'')+'__'+item.status;
   if(seen.get(item.id)===key)continue;
   seen.set(item.id,key);onInvitation(item);
  }
 },onError);
 return stop;
}
export async function liveProfile(uid){
 const s=await getSdk(),{fs,db}=s;
 if(typeof uid!=='string'||uid.length>128)throw Error('Invalid user ID');
 const snap=await fs.getDoc(fs.doc(db,'directory',uid));
 if(!snap.exists())return null;
 const data=snap.data();
 return {uid,id:data.id,name:data.name,avatar:data.avatar,photo:data.photo};
}
