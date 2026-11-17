// Opt-in real cloud account/profile sync. Requires a Firebase project and restrictive Firestore rules.
// Firestore is NOT an authoritative currency or ranking backend. Only profile metadata is uploaded.
import {firebaseSdk,firebaseReady} from './firebase-auth.js?v=11.2';
import {firebaseConfig} from './firebase-config.js?v=11.2';
let dbInit=null;
async function client(){
 if(!firebaseReady())throw Error('لا يوجد مشروع Firebase مرتبط');
 if(!dbInit)dbInit=(async()=>{
  const {auth}=await firebaseSdk();
  const mod=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
  const {getApp}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js');
  return {auth,mod,db:mod.getFirestore(getApp())};
 })().catch(err=>{dbInit=null;throw err;});return dbInit;
}
async function stableId(uid){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid));
 return 'SG-'+Array.from(new Uint8Array(bytes).slice(0,5),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
const safePhoto=photo=>typeof photo==='string'&&photo.startsWith('data:image/jpeg;base64,')&&photo.length<170000?photo:null;
function scrub(profile,uid,id){
 return {ownerUid:uid,id,name:String(profile.name||'لاعب سيجا').slice(0,24),
  avatar:String(profile.avatar||'🦁').slice(0,8),photo:safePhoto(profile.photo),
  color:['ruby','ocean','sun','jade'].includes(profile.color)?profile.color:'ruby',
  settings:{sound:profile.settings?.sound!==false,music:profile.settings?.music===true,allowSpectators:profile.settings?.allowSpectators===true},
  updatedAt:Date.now()};
}
export async function cloudReadOrCreate(local){
 const {auth,mod,db}=await client(),u=auth.currentUser;
 if(!u?.uid)throw Error('الحساب غير موثّق');
 const doc=mod.doc(db,'players',u.uid),found=await mod.getDoc(doc),id=await stableId(u.uid);
 if(found.exists()){
  const v=found.data();if(v.ownerUid!==u.uid)throw Error('بيانات الحساب غير مطابقة');
  return {id:v.id||id,name:v.name||local.name,avatar:v.avatar||'🦁',photo:safePhoto(v.photo),
   color:['ruby','ocean','sun','jade'].includes(v.color)?v.color:'ruby',settings:v.settings||local.settings};
 }
 const profile=scrub(local,u.uid,id);await mod.setDoc(doc,profile);return profile;
}
export async function cloudUpdate(local){
 if(!firebaseReady())return false;
 const {auth,mod,db}=await client(),u=auth.currentUser;if(!u?.uid)return false;
 const id=await stableId(u.uid),doc=mod.doc(db,'players',u.uid);
 await mod.setDoc(doc,scrub(local,u.uid,id),{merge:true});return true;
}
export async function cloudConnectionStatus(){if(!firebaseReady())return 'غير مربوط';
 const {auth}=await client();await auth.authStateReady?.();return auth.currentUser?'الحساب السحابي متصل':'لم يتم تسجيل الدخول';}