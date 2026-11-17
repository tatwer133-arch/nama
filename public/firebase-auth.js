import {firebaseConfig} from './firebase-config.js?v=11.1';
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
 })().catch(err=>{authInit=null;throw err;});
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
  if(['auth/popup-blocked','auth/cancelled-popup-request','auth/popup-closed-by-user'].includes(e?.code))throw Error('نافذة تسجيل الدخول اتقفلت أو المتصفح منعها. افتح السيجا في Chrome مباشرة وجرّب تاني.');
  if(e?.code==='auth/unauthorized-domain')throw Error('لازم تضيف seega-royale-eg.vercel.app في Firebase Authentication ← Settings ← Authorized domains.');
  if(e?.code==='auth/operation-not-allowed')throw Error('طريقة تسجيل الدخول دي غير مفعّلة في Firebase Authentication.');
  if(e?.code==='auth/operation-not-supported-in-this-environment')throw Error('المتصفح الداخلي لا يدعم تسجيل جوجل. افتح رابط اللعبة باستخدام Chrome العادي.');
  if(e?.code==='auth/network-request-failed')throw Error('تعذر الاتصال بـ Firebase؛ تأكد من الإنترنت وجرّب مرة أخرى.');
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
  if(kind==='register'&&name)await mod.updateProfile(result.user,{displayName:String(name).slice(0,24)}).catch(()=>{}); // Account creation has already succeeded; profile updates are best-effort.
  if(kind==='register'&&!result.user.emailVerified)await mod.sendEmailVerification(result.user).catch(()=>{});
  const u=result.user;
  return {provider:'email-cloud',uid:u.uid,email:u.email,name:u.displayName||name||'لاعب سيجا',photoURL:u.photoURL||null};
 }catch(e){
  const errors={'auth/email-already-in-use':'الإيميل مسجل بالفعل؛ استخدم تسجيل الدخول',
   'auth/invalid-email':'الإيميل غير صحيح','auth/weak-password':'كلمة السر ضعيفة',
   'auth/invalid-credential':'الإيميل أو كلمة السر غير صحيحة',
   'auth/operation-not-allowed':'تسجيل البريد الإلكتروني غير مفعّل في مشروع Firebase. مسؤول اللعبة لازم يفعّل Email/Password من Authentication → Sign-in method'};
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