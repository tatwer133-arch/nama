import test from 'node:test';
import assert from 'node:assert/strict';
import {openQuickRoom,openPrivateRoom,QUEUE_LEASE_MS} from '../server/queue-service.mjs';

const engine={init(mode){if(mode!=='seega3')throw Error('Bad mode');}};
function memory(){
 const data={active:{},matches:{},queues:{},friends:{}};
 const db={transaction:async fn=>{
  const clone=structuredClone(data);
  const tx={
   getActive:async uid=>clone.active[uid],
   putActive:(uid,matchId)=>{clone.active[uid]={matchId};},
   deleteActive:uid=>{delete clone.active[uid];},
   getMatch:async id=>clone.matches[id],
   putMatch:match=>{clone.matches[match.id]=match;},
   getQueue:async k=>clone.queues[k],
   putQueue:(k,v)=>{clone.queues[k]=v;},
   deleteQueue:k=>{delete clone.queues[k];}
  };
  const value=await fn(tx);Object.assign(data,clone);return value;
 },data};
 return db;
}
const open=(db,uid,id,stakeMinor=5000,now=1000)=>openQuickRoom(db,{uid,id,mode:'seega3',stakeMinor,now,engine});

test('first player waits in durable exact-mode, exact-stake queue',async()=>{
 const db=memory(),out=await open(db,'alice','ABCDEF');
 assert.equal(out.match.players[0].uid,'alice');
 assert.equal(out.matched,false);
 assert.equal(db.data.queues.seega3_5000.matchId,'ABCDEF');
 assert.equal(db.data.active.alice.matchId,'ABCDEF');
});
test('second distinct authenticated account claims the waiting seat',async()=>{
 const db=memory();await open(db,'alice','ABCDEF');
 const out=await open(db,'bob','KLMNPQ');
 assert.equal(out.matched,true);assert.equal(out.match.id,'ABCDEF');
 assert.equal(out.match.players[1].uid,'bob');
 assert.equal(db.data.queues.seega3_5000,undefined);
 assert.equal(db.data.active.bob.matchId,'ABCDEF');
});
test('same account cannot occupy two seats or two game rooms',async()=>{
 const db=memory();await open(db,'alice','ABCDEF');
 assert.equal((await open(db,'alice','KLMNPQ')).reused,true);
 await assert.rejects(openPrivateRoom(db,{uid:'alice',id:'RSTMNU',mode:'seega3',engine}),/active match/);
});
test('different stakes never match each other',async()=>{
 const db=memory();await open(db,'alice','ABCDEF',5000);
 const out=await open(db,'bob','KLMNPQ',1000);
 assert.equal(out.matched,false);
 assert.equal(db.data.queues.seega3_1000.matchId,'KLMNPQ');
 assert.equal(db.data.matches.ABCDEF.players[1],null);
});
test('expired unmatched queue is cancelled and safe to replace',async()=>{
 const db=memory();await open(db,'alice','ABCDEF',5000,1);
 const out=await open(db,'bob','KLMNPQ',5000,1+QUEUE_LEASE_MS+1);
 assert.equal(out.match.id,'KLMNPQ');
 assert.equal(db.data.matches.ABCDEF.status,'cancelled');
 assert.equal(db.data.active.alice,undefined);
});
test('queue rejects unapproved stakes, wrong modes and bad codes',async()=>{
 const db=memory();
 await assert.rejects(open(db,'alice','ABCDEF',7),/Unsupported stake/);
 await assert.rejects(openQuickRoom(db,{uid:'alice',id:'ABCDEF',mode:'fake',stakeMinor:0,engine}),/Bad mode/);
 await assert.rejects(open(db,'alice','000000'),/Invalid room code/);
});
test('private room starts free without exposing or changing wallet',async()=>{
 const db=memory();
 const out=await openPrivateRoom(db,{uid:'alice',id:'ABCDEF',mode:'seega3',engine});
 assert.equal(out.match.type,'private');assert.equal(out.match.stakeMinor,0);
 assert.equal(db.data.active.alice.matchId,'ABCDEF');
});
