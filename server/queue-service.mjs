/**
 * Firestore-transaction-backed matchmaking with exactly one queue slot per
 * (game variant, stake) and at most one active match per Firebase account.
 */
import {createMatch,transition} from './match-protocol.mjs';
export const STAKES_MINOR=Object.freeze([0,500,1000,2500,5000,10000,25000]);
export const QUEUE_LEASE_MS=90000;
const assert=(v,message)=>{if(!v)throw Error(message);};
const validMode=(mode,engine)=>{assert(typeof mode==='string'&&/^[a-z0-9]{3,32}$/.test(mode),'Invalid mode');engine.init(mode);};
export const queueKey=(mode,stakeMinor)=>mode+'_'+stakeMinor;
function openArgs({uid,mode,stakeMinor,id,engine}){
 assert(typeof uid==='string'&&uid.length>0,'Login required');
 assert(typeof id==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(id),'Invalid room code');
 assert(STAKES_MINOR.includes(stakeMinor),'Unsupported stake');
 validMode(mode,engine);
}
export async function openQuickRoom(db,args){
 openArgs(args);
 const {uid,mode,stakeMinor,id,engine,now=Date.now()}=args;
 const key=queueKey(mode,stakeMinor);
 return db.transaction(async tx=>{
  const active=await tx.getActive(uid);
  if(active){
   const old=await tx.getMatch(active.matchId);
   if(old&&old.type==='quick'&&old.status==='waiting'&&old.ownerUid===uid&&old.mode===mode&&old.stakeMinor===stakeMinor)
    return {match:old,matched:false,reused:true};
   throw Error('You already have an active match');
  }
  const queue=await tx.getQueue(key);
  const old=queue?.matchId?await tx.getMatch(queue.matchId):null;
  const candidate=old&&old.type==='quick'&&old.status==='waiting'&&!old.players[1]
   &&old.ownerUid!==uid&&old.mode===mode&&old.stakeMinor===stakeMinor
   &&queue.expiresAt>now;
  if(candidate){
   const joined=transition(old,{type:'quick-join',actorUid:uid,mode,stakeMinor,id:'quickjoin-'+uid},{now,engine}).match;
   tx.putMatch(joined);
   tx.deleteQueue(key);
   tx.putActive(uid,old.id);
   return {match:joined,matched:true,reused:false};
  }
  const exists=await tx.getMatch(id);
  assert(!exists,'Room code collision, try again');
  // A stale queue must not remain a second, joinable lobby.
  if(old&&old.status==='waiting'&&!old.players[1]){
   const staleOwner=await tx.getActive(old.ownerUid);
   const cancelled={...old,status:'cancelled',version:old.version+1};
   tx.putMatch(cancelled);
   if(staleOwner?.matchId===old.id)tx.deleteActive(old.ownerUid);
  }
  const room=createMatch({id,hostUid:uid,mode,type:'quick',stakeMinor});
  tx.putMatch(room);
  tx.putQueue(key,{matchId:id,ownerUid:uid,mode,stakeMinor,expiresAt:now+QUEUE_LEASE_MS});
  tx.putActive(uid,id);
  return {match:room,matched:false,reused:false};
 });
}
export async function openPrivateRoom(db,{uid,mode,id,engine}){
 openArgs({uid,mode,stakeMinor:0,id,engine});
 return db.transaction(async tx=>{
  assert(!await tx.getActive(uid),'You already have an active match');
  assert(!await tx.getMatch(id),'Room code collision, try again');
  const match=createMatch({id,hostUid:uid,mode,type:'private',stakeMinor:0});
  tx.putMatch(match);
  tx.putActive(uid,id);
  return {match,matched:false,reused:false};
 });
}
