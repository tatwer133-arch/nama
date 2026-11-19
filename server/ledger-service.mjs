/**
 * Seega Royale secure transaction boundary — staging, not connected to live DB.
 * Implement db.transaction with SERIALIZABLE isolation and durable unique ledger
 * constraints. Identity MUST be verified with Firebase Admin on the server.
 * Wallet amounts use integer hundredths of non-redeemable game coins.
 */
import {transition,payout,requireBackend} from './match-protocol.mjs';
const CLIENT_ACTIONS=new Set(['quick-join','invite','accept','kick','ready','leave','move','disconnect','reconnect']);
const SYSTEM_ACTIONS=new Set(['disconnect','reconnect','auto-move','disconnect-timeout']);
const assert=(x,message)=>{if(!x)throw new Error(message)};
const ledgerId=(type,id)=>type+':'+id;
async function getMoney(tx,uid){
 const wallet=await tx.getWallet(uid);
 assert(wallet&&Number.isSafeInteger(wallet.balanceMinor)&&wallet.balanceMinor>=0,'Invalid or missing wallet');
 return wallet;
}
async function reserve(tx,match,engine,now){
 assert(match.status==='pending_escrow'&&match.type==='quick','Escrow requires two ready quick players');
 const id=ledgerId('escrow',match.id);
 if(await tx.getLedger(id))return match;
 const [a,b]=match.players.map(x=>x?.uid);
 assert(a&&b&&a!==b,'Two distinct players required');
 // Free quick games are usable before any audited wallet migration.
 // Still create one idempotent 0-value escrow record and start atomically.
 if(match.stakeMinor===0){
  await tx.putLedger(id,{id,matchId:match.id,type:'escrow',users:[a,b],amountMinor:0,at:now});
  return transition(match,{type:'escrow-ok',fromServer:true,ref:id},{engine,now}).match;
 }
 const wA=await getMoney(tx,a),wB=await getMoney(tx,b);
 assert(wA.balanceMinor>=match.stakeMinor&&wB.balanceMinor>=match.stakeMinor,'Insufficient balance');
 // Both debits, ledger write and match-start MUST commit in one transaction.
 await tx.putWallet(a,{...wA,balanceMinor:wA.balanceMinor-match.stakeMinor});
 await tx.putWallet(b,{...wB,balanceMinor:wB.balanceMinor-match.stakeMinor});
 await tx.putLedger(id,{id,matchId:match.id,type:'escrow',users:[a,b],amountMinor:match.stakeMinor*2,at:now});
 const started=transition(match,{type:'escrow-ok',fromServer:true,ref:id},{engine,now}).match;
 assert(started.status==='playing','Escrow did not start match');
 return started;
}
async function settle(tx,match,now){
 if(match.type!=='quick'||match.stakeMinor===0)return;
 assert(match.status==='finished'&&match.escrowCommitted&&match.settlement,'Cannot settle unfinished match');
 const id=ledgerId('settle',match.id);
 if(await tx.getLedger(id))return; // unique per match: never pay twice
 assert(await tx.getLedger(ledgerId('escrow',match.id)),'Missing funded escrow');
 const plan=payout(match,match.settlement.winner);
 assert(plan.credits.every(x=>Number.isSafeInteger(x.amountMinor)&&x.amountMinor>=0),'Invalid payout amount');
 assert(plan.commissionMinor+plan.credits.reduce((n,x)=>n+x.amountMinor,0)===plan.potMinor,'Non-conserving settlement');
 // Firestore forbids transaction reads after the first write. Read every
 // destination wallet before mutating any of them, including a draw's two.
 const wallets=await Promise.all(plan.credits.map(async credit=>({credit,current:await getMoney(tx,credit.uid)})));
 for(const {credit,current} of wallets){
  const next=current.balanceMinor+credit.amountMinor;
  assert(Number.isSafeInteger(next),'Wallet integer overflow');
  await tx.putWallet(credit.uid,{...current,balanceMinor:next});
 }
 await tx.addHouseFee(plan.commissionMinor);
 await tx.putLedger(id,{id,matchId:match.id,type:'settlement',winner:match.settlement.winner,plan,at:now});
}
/**
 * For real requests, do NOT take actorUid from the browser. The database
 * controls access, authentication, wallet updates and game state in one txn.
 *
 * Adapter contract:
 * db.verifyIdentity(token) => trusted UID
 * db.transaction(async tx => ...)
 * tx.getMatch/putMatch/getWallet/putWallet/getLedger/putLedger/addHouseFee/areFriends.
 */
export async function executePlayerCommand(db,{token,matchId,command,engine,now=Date.now()}){
 requireBackend(db);
 assert(CLIENT_ACTIONS.has(command.type),'Client command not permitted');
 const uid=await db.verifyIdentity(token);assert(typeof uid==='string'&&uid,'Authentication required');
 return db.transaction(async tx=>{
  const old=await tx.getMatch(matchId);assert(old,'Room not found');
  if(command.type==='invite')assert(await tx.areFriends(uid,command.friendUid),'Accepted friendship required');
  // Acquire the private seat within the SAME transaction as accepting.
  if(command.type==='accept'&&tx.getActive)
   assert(!await tx.getActive(uid),'You already have an active match');
  const queue=command.type==='leave'&&old.type==='quick'&&old.status==='waiting'&&!old.players[1]&&tx.getQueue
   ? await tx.getQueue(old.mode+'_'+old.stakeMinor):null;
  const result=transition(old,{...command,actorUid:uid,fromServer:false},{engine,now});
  let next=result.match;
  for(const event of result.events){
   if(event.kind==='reserve-both-atomically')next=await reserve(tx,next,engine,now);
  }
  for(const event of result.events)if(event.kind==='settle-once')await settle(tx,next,now);
  if(!result.duplicate&&next.type==='private'&&tx.putInvitation)
   for(const inv of next.invites)tx.putInvitation(next.id,inv.uid,{matchId:next.id,fromUid:next.ownerUid,toUid:inv.uid,mode:next.mode,status:inv.status,createdAt:now,expiresAt:now+300000});
  if(!result.duplicate&&command.type==='accept'&&tx.putActive)tx.putActive(uid,matchId);
  if(!result.duplicate&&old.players[1]&&!next.players[1]&&tx.deleteActive)tx.deleteActive(old.players[1].uid);
  if(['finished','cancelled'].includes(next.status)&&tx.deleteActive)
   for(const seat of next.players.filter(Boolean))tx.deleteActive(seat.uid);
  if(queue?.matchId===matchId&&next.status!=='waiting'&&tx.deleteQueue)tx.deleteQueue(old.mode+'_'+old.stakeMinor);
  await tx.putMatch(next);
  return {match:next,duplicate:result.duplicate};
 });
}
/** Trusted server heartbeat/timer task only — never publicly callable with a
 * client-provided actor UID or fromServer flag. */
export async function executeServerCommand(db,{matchId,command,engine,now=Date.now()}){
 requireBackend(db);
 assert(SYSTEM_ACTIONS.has(command.type),'Not a scheduler command');
 return db.transaction(async tx=>{
  const old=await tx.getMatch(matchId);assert(old,'Match not found');
  const result=transition(old,{...command,fromServer:true},{engine,now});
  for(const e of result.events)if(e.kind==='settle-once')await settle(tx,result.match,now);
  if(['finished','cancelled'].includes(result.match.status)&&tx.deleteActive)
   for(const seat of result.match.players.filter(Boolean))tx.deleteActive(seat.uid);
  await tx.putMatch(result.match);
  return {match:result.match,duplicate:result.duplicate};
 });
}
