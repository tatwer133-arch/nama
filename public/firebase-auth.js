import {firebaseConfig} from './firebase-config.js?v=10';
export const firebaseReady=()=>Boolean(firebaseConfig?.apiKey&&firebaseConfig?.authDomain&&firebaseConfig?.projectId&&firebaseConfig?.appId);
let authInit=null;
export async function firebaseSdk(){
 if(!firebaseReady())throw Error('دخول جوجل وفيسبوك محتاج ربط حساب Firebase الخاص باللعبة وتفعيل مزود الدخول. تقدر تلعب كضيف أو بالإيميل المحلي حاليًا.');
 if(!authInit)authInit=(async()=>{
  const [{initializeApp,getApps,getApp},mod]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js')]);
  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  return{auth:mod.getAuth(app),mod};
 })();
 return authInit;
}
export async function firebaseSignIn(kind){
 const {auth,mod}=await firebaseSdk();
 const provider=kind==='google'?new mod.GoogleAuthProvider():kind==='facebook'?new mod.FacebookAuthProvider():null;
 if(!provider)throw Error('مزود الدخول غير مدعوم');
 // Firebase handles OAuth on the provider's own domain; this app never sees passwords.
 try{
  const result=await mod.signInWithPopup(auth,provider);
  const u=result.user;
  if(!u?.uid)throw Error('فشل التحقق من حسابك');
  return{provider:kind,uid:u.uid,email:u.email||null,name:u.displayName||'لاعب سيجا',photoURL:u.photoURL||null};
 }catch(e){
  if(e?.code==='auth/popup-blocked'||e?.code==='auth/cancelled-popup-request')throw Error('المتصفح منع نافذة الدخول. جرّب تسمح بالنوافذ المنبثقة.');
  if(e?.code==='auth/unauthorized-domain')throw Error('عنوان اللعبة مش مضاف لدومينات Firebase المصرح بها.');
  if(e?.code==='auth/account-exists-with-different-credential')throw Error('الإيميل مستخدم بطريقة دخول تانية.');
  throw Error('الدخول ما اكتملش: '+String(e?.message||'راجع إعدادات مزود الدخول'));
 }
}

export async function firebaseEmail(kind,email,password,name){
 const {auth,mod}=await firebaseSdk();
 try{
  const result=kind==='register'?
   await mod.createUserWithEmailAndPassword(auth,email,password):
   await mod.signInWithEmailAndPassword(auth,email,password);
  if(kind==='register'&&name)await mod.updateProfile(result.user,{displayName:String(name).slice(0,24)});
  if(kind==='register'&&!result.user.emailVerified)await mod.sendEmailVerification(result.user).catch(()=>{});
  const u=result.user;
  return {provider:'email-cloud',uid:u.uid,email:u.email,name:u.displayName||name||'لاعب سيجا',photoURL:u.photoURL||null};
 }catch(e){
  const errors={'auth/email-already-in-use':'الإيميل مسجل بالفعل؛ استخدم تسجيل الدخول',
   'auth/invalid-email':'الإيميل غير صحيح','auth/weak-password':'كلمة السر ضعيفة',
   'auth/invalid-credential':'الإيميل أو كلمة السر غير صحيحة',
   'auth/operation-not-allowed':'فعّل تسجيل الإيميل من Firebase Authentication'};
  throw Error(errors[e.code]||'فشل تسجيل الحساب السحابي: '+String(e.message||e.code));
 }
}
export async function firebaseCurrent(){if(!firebaseReady())return null;
 const {auth}=await firebaseSdk();await auth.authStateReady?.();
 const u=auth.currentUser;const providerId=u?.providerData[0]?.providerId;const provider=providerId==='google.com'?'google':providerId==='facebook.com'?'facebook':providerId==='password'?'email-cloud':'firebase';return u?{provider,uid:u.uid,name:u.displayName||'لاعب سيجا',email:u.email,photoURL:u.photoURL}:null;
}
export async function firebaseLogout(){if(!firebaseReady())return;
 const {auth,mod}=await firebaseSdk();await mod.signOut(auth);
}