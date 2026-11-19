/**
 * Firebase Cloud Functions v2 entry point for Seega Royale.
 * Callable authentication is verified by Firebase, never by a browser field.
 * No deployment is performed by committing this module.
 */
import {randomBytes} from 'node:crypto';
import {getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {createFirestoreBackend} from './firestore-backend.mjs';
import {openQuickRoom,openPrivateRoom,STAKES_MINOR} from './queue-service.mjs';
import {executePlayerCommand,executeServerCommand} from './ledger-service.mjs';
import {serverGameRules} from './game-rules-adapter.mjs';

if(!getApps().length)initializeApp();
const store=getFirestore(), REGION='europe-west1';
const opts={region:REGION,timeoutSeconds:30,maxInstances:30,memory:'256MiB'};
const allowed=new Set(['invite','accept','kick','ready','leave','move','disconnect','reconnect']);
const roomCode=()=>[...randomBytes(6)].map(b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
const assert=(ok,message)=>{if(!ok)throw new HttpsError('failed-precondition',message)};
const auth=req=>{
 const uid=req.auth?.uid;
 if(typeof uid!=='string'||!uid)throw new HttpsError('unauthenticated','سجّل دخول بحساب Firebase حقيقي');
 return uid; // verified by onCall Firebase Auth middleware
};
const backend=uid=>createFirestoreBackend(store,{
 FieldValue,
 verifyIdentity:async input=>{
  // The input is constructed exclusively from req.auth.uid by the trusted
  // handler. No unverified uid or browser-provided token reaches this method.
  assert(input===uid,'Invalid Firebase identity');
  return uid;
 }
});
const sendError=e=>{
 if(e instanceof HttpsError)throw e;
 const m=String(e?.message||'Internal operation failed');
 if(/Insufficient balance|Invalid or missing wallet/.test(m))
  throw new HttpsError('failed-precondition','رصيد الرهان السحابي غير جاهز أو غير كافٍ؛ الرصيد المحلي لم يتم ترحيله');
 if(/You already have an active match|You already have an active|Room already started|Room full|Not your turn|Turn expired|Unauthorized|Accepted friendship|Illegal move|Room code collision|Invalid|Waiting for opponent|Host only|Uncommitted|No active/.test(m))
  throw new HttpsError('failed-precondition',m);
 console.error('Seega server operation:',e);
 throw new HttpsError('internal','تعذّر تنفيذ العملية على خادم اللعب');
};
async function attemptOpen(op,uid,input){
 for(let i=0;i<4;i++){
  try{
   return await op(backend(uid),{uid,mode:input.mode,stakeMinor:input.stakeMinor,id:roomCode(),engine:serverGameRules});
  }catch(e){if(/Room code collision/.test(String(e.message))&&i<3)continue;throw e;}
 }
 throw Error('Room code generation failed');
}
function openResult(x){return {...x,serverTime:Date.now()};}
async function scheduleTurn(match){
 if(!match||!['playing','reconnecting'].includes(match.status)||!Number.isFinite(match.deadline))return;
 const delay=Math.max(1,Math.ceil((match.deadline-Date.now())/1000));
 try{
  await getFunctions().taskQueue('expireSeegaTurn').enqueue({matchId:match.id,version:match.version},
   {scheduleDelaySeconds:delay});
 }catch(e){
  // State is already committed: scheduler fallback will handle the timeout.
  console.error('Seega task enqueue failed; sweep fallback is enabled',e);
 }
}
function validCommand(input){
 assert(input&&typeof input==='object'&&!Array.isArray(input),'Invalid command');
 const {type,id}=input;
 assert(allowed.has(type),'Invalid player command');
 assert(typeof id==='string'&&id.length>=8&&id.length<=100,'Command ID required');
 const command={type,id};
 if(type==='invite'){
  assert(typeof input.friendUid==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(input.friendUid),'Invalid friend');
  command.friendUid=input.friendUid;
 }
 if(type==='ready')command.ready=input.ready===true;
 if(type==='move'){
  const a=input.action;
  assert(a&&['place','move'].includes(a.kind)&&Number.isInteger(a.to)&&a.to>=0&&a.to<=120,'Invalid move');
  if(a.kind==='move')assert(Number.isInteger(a.from)&&a.from>=0&&a.from<=120,'Invalid move origin');
  command.action=a.kind==='move'?{kind:a.kind,from:a.from,to:a.to}:{kind:a.kind,to:a.to};
 }
 return command;
}
const playerRoom=(m,uid)=>m?.players?.some(p=>p?.uid===uid);
async function joinedMatch(id,uid){
 assert(typeof id==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(id),'Invalid match code');
 const snap=await store.collection('gameMatches').doc(id).get();
 assert(snap.exists&&playerRoom(snap.data(),uid),'Room missing or access denied');
 return snap.data();
}

export const openSeegaQuick=onCall(opts,async req=>{
 const uid=auth(req);
 try{
  const {mode,stakeMinor}=req.data||{};
  assert(STAKES_MINOR.includes(stakeMinor),'Choose an approved game stake');
  return openResult(await attemptOpen(openQuickRoom,uid,{mode,stakeMinor}));
 }catch(e){sendError(e);}
});
export const openSeegaPrivate=onCall(opts,async req=>{
 const uid=auth(req);
 try{return openResult(await attemptOpen(openPrivateRoom,uid,{mode:req.data?.mode,stakeMinor:0}));}
 catch(e){sendError(e);}
});
export const commandSeegaMatch=onCall(opts,async req=>{
 const uid=auth(req);
 try{
  const matchId=req.data?.matchId;
  assert(typeof matchId==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(matchId),'Invalid match');
  const command=validCommand(req.data?.command);
  const result=await executePlayerCommand(backend(uid),{
   token:uid,matchId,command,engine:serverGameRules
  });
  await scheduleTurn(result.match);
  return openResult(result);
 }catch(e){sendError(e);}
});
export const readSeegaWallet=onCall(opts,async req=>{
 const uid=auth(req);
 const snap=await store.collection('gameWallets').doc(uid).get();
 return {status:snap.exists?'ready':'migration-required',
  balanceMinor:snap.exists?snap.data().balanceMinor:null};
});
export const postSeegaChat=onCall(opts,async req=>{
 const uid=auth(req);
 try{
  const id=req.data?.matchId,body=req.data?.text;
  assert(typeof id==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(id),'Invalid match');
  assert(typeof body==='string'&&body.trim().length>0&&body.length<=200,'Invalid chat message');
  const text=body.trim();
  const result=await store.runTransaction(async tx=>{
   const roomRef=store.collection('gameMatches').doc(id);
   const roomSnap=await tx.get(roomRef);
   assert(roomSnap.exists&&playerRoom(roomSnap.data(),uid),'Not in this room');
   assert(['waiting','pending_escrow','playing','reconnecting'].includes(roomSnap.data().status),'Chat is closed');
   const throttle=roomRef.collection('chatThrottle').doc(uid);
   const last=await tx.get(throttle),now=Date.now();
   assert(!last.exists||now-last.data().at>=750,'Sending too quickly');
   const msg=roomRef.collection('chat').doc();
   tx.set(throttle,{at:now});
   tx.create(msg,{uid,text,at:FieldValue.serverTimestamp()});
   return {id:msg.id};
  });
  return result;
 }catch(e){sendError(e);}
});
export const signalSeegaVoice=onCall(opts,async req=>{
 const uid=auth(req);
 try{
  const id=req.data?.matchId,toUid=req.data?.toUid,payload=req.data?.payload;
  assert(typeof id==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(id),'Invalid room');
  assert(typeof toUid==='string'&&toUid.length>0&&toUid!==uid,'Invalid recipient');
  assert(payload&&['voice-request','voice-accept','voice-decline','voice-cancel','offer','answer','candidate','hangup'].includes(payload.type),'Invalid signaling type');
  assert(JSON.stringify(payload).length<=7000,'Signal is too large');
  const match=await joinedMatch(id,uid);
  assert(match.status==='playing'||match.status==='reconnecting','Voice only during a real match');
  assert(match.players.some(p=>p?.uid===toUid),'Recipient not in match');
  const ref=store.collection('gameMatches').doc(id).collection('signals').doc();
  await ref.create({fromUid:uid,toUid,payload,at:FieldValue.serverTimestamp()});
  return {id:ref.id};
 }catch(e){sendError(e);}
});

async function runTimeout(matchId,version,now=Date.now()){
 const ref=store.collection('gameMatches').doc(matchId),snap=await ref.get();
 if(!snap.exists)return {ignored:true};
 const match=snap.data();
 if(version!==null&&match.version!==version)return {ignored:true};
 if(match.status==='reconnecting'){
  const disconnected=match.players.filter(p=>p&&!p.connected&&Number.isFinite(p.disconnectedAt));
  if(!disconnected.length||!disconnected.some(p=>now>=p.disconnectedAt+match.graceMs))return {ignored:true};
  const out=await executeServerCommand(backend('__trusted_timer__'),{matchId,
   command:{type:'disconnect-timeout',id:'disconnect-'+match.id+'-'+match.version},
   engine:serverGameRules,now});
  return {status:out.match.status};
 }
 if(match.status!=='playing'||!Number.isFinite(match.deadline)||now<match.deadline)return {ignored:true};
 const out=await executeServerCommand(backend('__trusted_timer__'),{matchId,
  command:{type:'auto-move',id:'autoturn-'+match.id+'-'+match.version},engine:serverGameRules,now});
 await scheduleTurn(out.match);
 return {status:out.match.status};
}
export const expireSeegaTurn=onTaskDispatched({region:REGION,timeoutSeconds:60,
 retryConfig:{maxAttempts:3,minBackoffSeconds:2}},async req=>{
 const id=req.data?.matchId,v=req.data?.version;
 if(typeof id!=='string'||!Number.isInteger(v))return;
 try{await runTimeout(id,v);}catch(e){console.error('Turn timeout task failed',e);throw e;}
});
export const sweepSeegaTimeouts=onSchedule({region:REGION,schedule:'every 1 minutes',
 timeZone:'Etc/UTC',timeoutSeconds:120},async()=>{
 // Backstop for lost Cloud Tasks dispatch. Single-field deadline query.
 const overdue=await store.collection('gameMatches').where('deadline','<=',Date.now()).limit(100).get();
 await Promise.all(overdue.docs.map(async doc=>{
  try{await runTimeout(doc.id,null);}catch(e){console.error('Overdue game',doc.id,e);}
 }));
});
