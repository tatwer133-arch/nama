import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,transition} from '../server/match-protocol.mjs';
import {executePlayerCommand,executeServerCommand} from '../server/ledger-service.mjs';

const engine={
 init:()=>({turn:0,board:[0,0,0],winner:null}),
 legal:g=>g.board.flatMap((v,to)=>v===0?[{kind:'place',to}]:[]),
 apply(g,p,a){
  const legal=this.legal(g);
  if(!legal.some(x=>x.kind===a?.kind&&x.to===a.to))return {ok:false};
  const b=g.board.slice();b[a.to]=p+1;
  return {ok:true,game:{turn:1-p,board:b,winner:b.every(Boolean)?p:null}};
 }
};
function memoryBackend(initial,balances={alice:10000,bob:10000,carl:10000}){
 let state={matches:{[initial.id]:initial},wallets:Object.fromEntries(Object.entries(balances).map(([uid,balanceMinor])=>[uid,{balanceMinor}])),ledger:{},houseFee:0};
 const backend={
  async verifyIdentity(token){if(!balances[token])throw Error('Bad token');return token;},
  uniqueLedger(){}, // Production adapter must enforce UNIQUE(id) at DB level
  async transaction(fn){
   const work=structuredClone(state);
   const tx={
    async getMatch(id){return work.matches[id];},
    async putMatch(m){work.matches[m.id]=m;},
    async getWallet(uid){return work.wallets[uid];},
    async putWallet(uid,data){work.wallets[uid]=data;},
    async getLedger(id){return work.ledger[id]||null;},
    async putLedger(id,data){if(work.ledger[id])throw Error('Duplicate ledger key');work.ledger[id]=data;},
    async addHouseFee(amount){work.houseFee+=amount;},
    async areFriends(a,b){return a==='alice'&&(b==='bob'||b==='carl');},
   };
   const output=await fn(tx);
   state=work;return output;
  },
  state(){return structuredClone(state);}
 };
 return backend;
}
const makeQuick=()=>{
 let m=createMatch({id:'match-123',hostUid:'alice',mode:'seega3',type:'quick',stakeMinor:5000});
 return transition(m,{type:'quick-join',actorUid:'bob',mode:'seega3',stakeMinor:5000}).match;
};
const player=(db,token,type,rest={})=>executePlayerCommand(db,{token,matchId:'match-123',command:{type,...rest},engine,now:2000});
test('Ready twice atomically reserves exactly 50.00 each and starts game',async()=>{
 const db=memoryBackend(makeQuick());
 await player(db,'alice','ready',{ready:true});
 assert.equal(db.state().matches['match-123'].status,'waiting');
 await player(db,'bob','ready',{ready:true});
 const s=db.state();
 assert.equal(s.matches['match-123'].status,'playing');
 assert.equal(s.wallets.alice.balanceMinor,5000);
 assert.equal(s.wallets.bob.balanceMinor,5000);
 assert.equal(Object.keys(s.ledger).length,1);
 assert.equal(s.ledger['escrow:match-123'].amountMinor,10000);
});
test('Balance failure rolls back Ready and both debits',async()=>{
 const db=memoryBackend(makeQuick(),{alice:10000,bob:4000});
 await player(db,'alice','ready',{ready:true});
 await assert.rejects(player(db,'bob','ready',{ready:true}),/Insufficient/);
 const s=db.state();assert.equal(s.wallets.alice.balanceMinor,10000);
 assert.equal(s.wallets.bob.balanceMinor,4000);
 assert.equal(s.matches['match-123'].status,'waiting');
 assert.equal(s.matches['match-123'].players[1].ready,false);
});
test('Forfeit credits winner once, pays house exactly 5%',async()=>{
 const db=memoryBackend(makeQuick());
 await player(db,'alice','ready',{ready:true});
 await player(db,'bob','ready',{ready:true});
 await player(db,'bob','leave',{id:'leave-bob-01'});
 const s=db.state();
 assert.equal(s.wallets.alice.balanceMinor,14500);
 assert.equal(s.wallets.bob.balanceMinor,5000);
 assert.equal(s.houseFee,500);
 assert.equal(s.ledger['settle:match-123'].plan.credits[0].amountMinor,9500);
 await player(db,'bob','leave',{id:'leave-bob-01'});
 const t=db.state();
 assert.equal(t.wallets.alice.balanceMinor,14500);
 assert.equal(Object.keys(t.ledger).length,2);
});
test('Cannot submit server auto-move or server financial commands from client',async()=>{
 const db=memoryBackend(makeQuick());
 await assert.rejects(player(db,'alice','auto-move'),/Client command not permitted/);
 await assert.rejects(player(db,'alice','escrow-ok'),/Client command not permitted/);
});
test('A private invite requires a verified accepted friendship',async()=>{
 const match=createMatch({id:'match-123',hostUid:'alice',mode:'seega3',type:'private'});
 const db=memoryBackend(match);
 await assert.rejects(player(db,'alice','invite',{friendUid:'david'}),/Accepted friendship/);
 await player(db,'alice','invite',{friendUid:'bob'});
 await player(db,'alice','invite',{friendUid:'carl'});
 await player(db,'carl','accept');
 await assert.rejects(player(db,'bob','accept'),/Room full/);
 assert.equal(db.state().matches['match-123'].players[1].uid,'carl');
});
test('A private room starts free; kick before start does not touch balances',async()=>{
 const match=createMatch({id:'match-123',hostUid:'alice',mode:'seega3',type:'private'});
 const db=memoryBackend(match);
 await player(db,'alice','invite',{friendUid:'bob'});
 await player(db,'bob','accept');
 await player(db,'alice','kick');
 const s=db.state();assert.equal(s.matches['match-123'].players[1],null);
 assert.equal(s.wallets.alice.balanceMinor,10000);assert.equal(s.houseFee,0);
});
test('Trusted server turn timeout applies a legal action',async()=>{
 const db=memoryBackend(makeQuick());
 await player(db,'alice','ready',{ready:true});
 await player(db,'bob','ready',{ready:true});
 const result=await executeServerCommand(db,{matchId:'match-123',command:{type:'auto-move',id:'auto-step-0001'},engine,now:40000});
 assert.equal(result.match.game.board[0],1);
 assert.equal(result.match.game.turn,1);
 assert.equal(result.match.deadline,70000);
});
