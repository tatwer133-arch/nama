import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirestoreBackend} from '../server/firestore-backend.mjs';
import {createMatch,transition} from '../server/match-protocol.mjs';
import {openPrivateRoom} from '../server/queue-service.mjs';
import {executePlayerCommand} from '../server/ledger-service.mjs';
import {serverGameRules as engine} from '../server/game-rules-adapter.mjs';

function firestoreMock(initial={}){
 const persisted=new Map(Object.entries(initial).map(([k,v])=>[k,structuredClone(v)]));
 const FieldValue={increment:n=>({__increment:n})};
 const firestore={
  collection(name){return {doc(id){return {path:name+'/'+id};}};},
  async runTransaction(fn){
   const working=new Map([...persisted.entries()].map(([k,v])=>[k,structuredClone(v)]));
   let written=false;
   const tx={
    async get(ref){
     assert(!written,'Firestore forbids a read after a write in a transaction');
     const data=working.get(ref.path);
     return {exists:data!==undefined,data:()=>structuredClone(data)};
    },
    set(ref,value,options={}){
     written=true;
     const old=options.merge?working.get(ref.path)||{}:{};
     const next={...old};
     for(const [k,v] of Object.entries(value))
      next[k]=v&&typeof v==='object'&&'__increment' in v?
       (Number(old[k]||0)+v.__increment):structuredClone(v);
     working.set(ref.path,next);
    },
    create(ref,value){
     written=true;
     assert(!working.has(ref.path),'Duplicate document key');
     working.set(ref.path,structuredClone(value));
    },
    delete(ref){written=true;working.delete(ref.path);}
   };
   const out=await fn(tx);
   persisted.clear();for(const [k,v] of working)persisted.set(k,v);
   return out;
  }
 };
 const db=uid=>createFirestoreBackend(firestore,{
  FieldValue,
  verifyIdentity:async token=>{assert.equal(token,uid,'Firebase identity must be trusted');return uid;}
 });
 return {db,data:p=>persisted.get(p),persisted};
}
const send=(db,uid,id,type,rest={})=>executePlayerCommand(db(uid),{
 token:uid,matchId:id,command:{type,id:type+'-command-'+uid,...rest},engine,now:1000
});

test('Firestore escrow and forfeit settle with durable unique IDs and exact fee',async()=>{
 const id='ABCDEF';
 const quick=createMatch({id,hostUid:'alice',mode:'seega3',type:'quick',stakeMinor:5000});
 const paired=transition(quick,{type:'quick-join',actorUid:'bob',mode:'seega3',stakeMinor:5000}).match;
 const m=firestoreMock({
  ['gameMatches/'+id]:paired,
  'gameActive/alice':{matchId:id},'gameActive/bob':{matchId:id},
  'gameWallets/alice':{balanceMinor:10000},'gameWallets/bob':{balanceMinor:10000}
 });
 await send(m.db,'alice',id,'ready',{ready:true});
 await send(m.db,'bob',id,'ready',{ready:true});
 assert.equal(m.data('gameWallets/alice').balanceMinor,5000);
 assert.equal(m.data('gameWallets/bob').balanceMinor,5000);
 assert.equal(m.data('gameLedger/escrow:'+id).amountMinor,10000);
 assert.equal(m.data('gameMatches/'+id).status,'playing');
 await send(m.db,'bob',id,'leave');
 assert.equal(m.data('gameWallets/alice').balanceMinor,14500);
 assert.equal(m.data('gameWallets/bob').balanceMinor,5000);
 assert.equal(m.data('gameHouse/fees').totalMinor,500);
 assert.equal(m.data('gameLedger/settle:'+id).plan.commissionMinor,500);
 assert.equal(m.data('gameActive/alice'),undefined);
 assert.equal(m.data('gameActive/bob'),undefined);
 // Duplicate commands cannot pay an escrow settlement twice.
 await send(m.db,'bob',id,'leave');
 assert.equal(m.data('gameWallets/alice').balanceMinor,14500);
 assert.equal(m.data('gameHouse/fees').totalMinor,500);
});
test('Private invitations are accepted by friends only and claim their seat',async()=>{
 const m=firestoreMock({'friendRequests/alice__bob':{
  fromUid:'alice',toUid:'bob',status:'accepted'
 }});
 await openPrivateRoom(m.db('alice'),{uid:'alice',mode:'seega3',id:'ABCDEF',engine});
 await assert.rejects(send(m.db,'alice','ABCDEF','invite',{friendUid:'carl'}),/Accepted friendship/);
 await send(m.db,'alice','ABCDEF','invite',{friendUid:'bob'});
 assert.equal(m.data('gameInvitations/ABCDEF__bob').status,'pending');
 await send(m.db,'bob','ABCDEF','accept');
 assert.equal(m.data('gameActive/bob').matchId,'ABCDEF');
 assert.equal(m.data('gameInvitations/ABCDEF__bob').status,'accepted');
 await send(m.db,'alice','ABCDEF','kick');
 assert.equal(m.data('gameActive/bob'),undefined);
 assert.equal(m.data('gameInvitations/ABCDEF__bob').status,'cancelled');
 await send(m.db,'alice','ABCDEF','invite',{friendUid:'bob',id:'new-invite-0001'});
 assert.equal(m.data('gameInvitations/ABCDEF__bob').status,'pending');
});
test('Backend checks identity and rejects missing wallets rather than trusting localStorage',async()=>{
 const m=firestoreMock();
 await assert.rejects(m.db('alice').verifyIdentity('bob'),/Firebase identity/);
 const id='ABCDEF';
 const quick=createMatch({id,hostUid:'alice',mode:'seega3',type:'quick',stakeMinor:5000});
 const paired=transition(quick,{type:'quick-join',actorUid:'bob',mode:'seega3',stakeMinor:5000}).match;
 await m.db('alice').transaction(async tx=>tx.putMatch(paired));
 await send(m.db,'alice',id,'ready',{ready:true});
 await assert.rejects(send(m.db,'bob',id,'ready',{ready:true}),/Invalid or missing wallet/);
 assert.equal(m.data('gameLedger/escrow:'+id),undefined);
 assert.equal(m.data('gameMatches/'+id).status,'waiting');
});
