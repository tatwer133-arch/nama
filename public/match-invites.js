// Explicit invitation state machine. Recipient must accept before joining.
import {firebaseSdk} from './firebase-auth.js?v=11.3';
const LIFETIME_MS=5*60*1000;
let client=null,unsubs=[],me=null,onIncoming=()=>{},onUpdate=()=>{},onStatus=()=>{},invitations=[],outgoing=[],seen=new Map();
const timestamp=x=>x?.toMillis?.()||0;
const cleanRoom=s=>/^[A-Z0-9]{6}$/.test(String(s||''))?s:'';
const friendly=e=>e?.code==='permission-denied'
 ?'طلبات التحدي تحتاج نشر قواعد Firestore الجديدة من الملف firestore.rules في Firebase → Firestore → Rules'
 :String(e?.message||'تعذر إرسال دعوة المباراة');
async function init(){
 if(client)return client;
 const {auth}=await firebaseSdk();await auth.authStateReady?.();
 if(!auth.currentUser?.uid)throw Error('لازم تسجل دخول بحساب حقيقي');
 const fs=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
 const {getApp}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js');
 client={fs,db:fs.getFirestore(getApp()),auth};me=auth.currentUser.uid;return client;
}
function decorate(d){const v=d.data();return{id:d.id,...v,at:timestamp(v.createdAt)};}
function alive(v){return v.status==='pending'&&v.at>0&&Date.now()-v.at<LIFETIME_MS;}
function emitUpdate(){onUpdate(invitations.filter(alive),outgoing.filter(alive));}
export async function matchInvitesStart(handlers={}){
 await matchInvitesStop();onIncoming=handlers.onIncoming||(()=>{});onUpdate=handlers.onUpdate||(()=>{});onStatus=handlers.onStatus||(()=>{});
 const {fs,db}=await init(),uid=me;
 const recv=fs.query(fs.collection(db,'matchInvites'),fs.where('toUid','==',uid));
 const sent=fs.query(fs.collection(db,'matchInvites'),fs.where('fromUid','==',uid));
 unsubs.push(fs.onSnapshot(recv,snap=>{
  invitations=snap.docs.map(decorate).sort((a,b)=>b.at-a.at);
  emitUpdate();
  for(const c of snap.docChanges()){
   const data=decorate(c.doc);
   if(['added','modified'].includes(c.type)&&alive(data)&&seen.get(data.id)!=='pending'){seen.set(data.id,'pending');onIncoming(data);}
  }
 },e=>onStatus({kind:'error',text:friendly(e)})));
 unsubs.push(fs.onSnapshot(sent,snap=>{
  outgoing=snap.docs.map(decorate).sort((a,b)=>b.at-a.at);emitUpdate();
  for(const c of snap.docChanges()){
   const data=decorate(c.doc),prior=seen.get(data.id);
   seen.set(data.id,data.status);
   if(prior==='pending'&&data.status==='accepted')onStatus({kind:'accepted',text:'✅ صاحبك وافق على المباراة',id:data.id});
   else if(prior==='pending'&&data.status==='rejected')onStatus({kind:'rejected',text:'❌ صاحبك رفض المباراة',id:data.id});
  }
 },e=>onStatus({kind:'error',text:friendly(e)})));
}
export function matchPending(){return invitations.filter(alive);}
export async function matchCreate(uid,roomCode,name){
 const {fs,db}=await init();
 if(!uid||uid===me)throw Error('اختار لاعب غيرك');
 const code=cleanRoom(roomCode);if(!code)throw Error('اعمل غرفة صحيحة الأول');
 const ref=fs.doc(db,'matchInvites',me+'__'+uid);
 try{await fs.setDoc(ref,{fromUid:me,toUid:uid,roomCode:code,fromName:String(name||'لاعب سيجا').slice(0,24),
  status:'pending',createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});}
 catch(e){throw Error(friendly(e));}
 seen.set(ref.id,'pending');
 return ref.id;
}
export async function matchRespond(id,accept){
 const {fs,db}=await init();
 const item=invitations.find(v=>v.id===id);
 if(!item||item.toUid!==me||!alive(item))throw Error('الدعوة انتهت، خلي صاحبك يبعت واحدة جديدة');
 try{await fs.updateDoc(fs.doc(db,'matchInvites',id),{status:accept?'accepted':'rejected',updatedAt:fs.serverTimestamp()});}
 catch(e){throw Error(friendly(e));}
}
export async function matchCancel(id){
 if(!id)return;
 try{
  const {fs,db}=await init(),ref=fs.doc(db,'matchInvites',id);
  const item=outgoing.find(v=>v.id===id);
  const data=item||(await fs.getDoc(ref)).data();
  if(data?.fromUid===me&&data?.status==='pending')
    await fs.updateDoc(ref,{status:'cancelled',updatedAt:fs.serverTimestamp()});
 }catch{}
}
export async function matchInvitesStop(){
 for(const unsub of unsubs.splice(0))try{unsub();}catch{}
 client=null;me=null;seen.clear();invitations=[];outgoing=[];onUpdate([],[]);
}
