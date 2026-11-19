import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,transition,payout,findQuick,requireBackend} from '../server/match-protocol.mjs';
const rules={
 init:()=>({turn:0,winner:null,board:[0,0,0]}),
 legal:g=>g.board.flatMap((x,to)=>x===0?[{kind:'place',to}]:[]),
 apply(g,p,a){if(g.board[a.to]!==0||!this.legal(g).some(x=>x.to===a.to))return {ok:false};
   const board=g.board.slice();board[a.to]=p+1;
   return {ok:true,game:{turn:1-p,winner:board.every(x=>x)?p:null,board}};},
};
const quick=()=>createMatch({id:'test-0001',hostUid:'alice',mode:'seega3',type:'quick',stakeMinor:5000});
const privateRoom=()=>createMatch({id:'test-0002',hostUid:'alice',mode:'seega3',type:'private'});
const apply=(m,type,actorUid,extra={},now=1000)=>transition(m,{type,actorUid,...extra},{now,engine:rules});
const pair=()=>apply(quick(),'quick-join','bob',{mode:'seega3',stakeMinor:5000}).match;
const ready=m=>apply(apply(m,'ready','alice',{ready:true}).match,'ready','bob',{ready:true});
const started=()=>{
 const x=ready(pair()).match;
 return apply(x,'escrow-ok',undefined,{fromServer:true,ref:x.escrowRef}).match;
};
test('quick matchmaking exact game and stake only',()=>{
 const m=quick();
 assert.equal(findQuick([m],{mode:'seega3',stakeMinor:5000,uid:'bob'}).id,m.id);
 assert.equal(findQuick([m],{mode:'chinese',stakeMinor:5000,uid:'bob'}),null);
 assert.equal(findQuick([m],{mode:'seega3',stakeMinor:10000,uid:'bob'}),null);
 assert.equal(findQuick([m],{mode:'seega3',stakeMinor:5000,uid:'alice'}),null);
});
test('private matches cannot have wager',()=>assert.throws(()=>createMatch({id:'m12345',hostUid:'a',mode:'seega3',type:'private',stakeMinor:5000})));
test('first accepting friend wins seat and other invitations expire',()=>{
 let m=privateRoom();
 m=apply(m,'invite','alice',{friendUid:'bob'}).match;
 m=apply(m,'invite','alice',{friendUid:'carl'}).match;
 m=apply(m,'accept','carl').match;
 assert.equal(m.players[1].uid,'carl');
 assert.deepEqual(m.invites.map(i=>i.status),['cancelled','accepted']);
 assert.throws(()=>apply(m,'accept','bob'));
});
test('Ready is required from both before a private match starts',()=>{
 let m=privateRoom();m=apply(m,'invite','alice',{friendUid:'bob'}).match;
 m=apply(m,'accept','bob').match;m=apply(m,'ready','alice',{ready:true}).match;
 assert.equal(m.status,'waiting');
 assert.equal(apply(m,'ready','bob',{ready:true}).match.status,'playing');
});
test('quick match waits for escrow confirmation and server-only signal',()=>{
 let m=ready(pair()).match;assert.equal(m.status,'pending_escrow');
 assert.throws(()=>apply(m,'escrow-ok',undefined,{ref:m.escrowRef}));
 m=apply(m,'escrow-ok',undefined,{fromServer:true,ref:m.escrowRef}).match;
 assert.equal(m.status,'playing');assert.equal(m.escrowCommitted,true);
});
test('escrow failure resets both ready flags without starting',()=>{
 let m=ready(pair()).match;m=apply(m,'escrow-failed',undefined,{fromServer:true}).match;
 assert.equal(m.status,'waiting');assert.equal(m.game,null);
 assert.ok(m.players.every(p=>!p.ready));
});
test('leaving or being kicked before start has no settlement',()=>{
 let x=ready(pair());let a=apply(x.match,'leave','bob');
 assert.equal(a.match.status,'waiting');assert.equal(a.match.players[1],null);
 assert.equal(a.events.filter(e=>e.kind==='settle-once').length,0);
 let m=privateRoom();m=apply(m,'invite','alice',{friendUid:'bob'}).match;m=apply(m,'accept','bob').match;
 assert.equal(apply(m,'kick','alice').match.players[1],null);
});
test('winner gets 95 virtual coins from two 50-coin stakes',()=>{
 const x=payout(started(),'alice');
 assert.equal(x.potMinor,10000);assert.equal(x.commissionMinor,500);
 assert.deepEqual(x.credits,[{uid:'alice',amountMinor:9500}]);
});
test('draw returns 47.50 virtual coins to each',()=>{
 const x=payout(started(),'draw');
 assert.deepEqual(x.credits,[{uid:'alice',amountMinor:4750},{uid:'bob',amountMinor:4750}]);
 assert.equal(x.credits.reduce((n,r)=>n+r.amountMinor,0)+x.commissionMinor,x.potMinor);
});
test('post-start forfeit settles once with unique key',()=>{
 let m=started();let x=apply(m,'leave','alice',{id:'forfeit01'});
 assert.equal(x.match.status,'finished');
 assert.equal(x.events.find(e=>e.kind==='settle-once').key,'settle:test-0001');
 assert.equal(apply(x.match,'leave','alice',{id:'forfeit01'}).duplicate,true);
 assert.throws(()=>apply(x.match,'leave','alice',{id:'forfeit02'}));
});
test('reconnect during grace avoids loss; expiry forfeits',()=>{
 let m=started();m=apply(m,'disconnect','bob',{},3000).match;
 assert.equal(m.status,'reconnecting');
 assert.throws(()=>apply(m,'disconnect-timeout',undefined,{fromServer:true},16000));
 m=apply(m,'reconnect','bob',{},16001).match;assert.equal(m.status,'playing');
 m=apply(m,'disconnect','bob',{},20000).match;
 assert.equal(apply(m,'disconnect-timeout',undefined,{fromServer:true},36000).match.settlement.winner,'alice');
});
test('timed-out turn produces a server-validated legal move',()=>{
 let m=started();
 assert.throws(()=>apply(m,'auto-move',undefined,{fromServer:true},10000));
 const x=apply(m,'auto-move',undefined,{fromServer:true,id:'timeout01'},50000);
 assert.equal(x.match.game.board[0],1);assert.equal(x.match.game.turn,1);
 assert.ok(x.events.some(e=>e.kind==='auto-move'));
 assert.equal(apply(x.match,'auto-move',undefined,{fromServer:true,id:'timeout01'},50000).duplicate,true);
});
test('no stake execution without durable authenticated backend',()=>{
 assert.throws(()=>requireBackend({}),/ACID backend/);
 assert.equal(requireBackend({transaction(){},verifyIdentity(){},uniqueLedger(){}}),true);
});


test('private invites expire after five minutes; decline, then re-invite resets the clock',()=>{
 let m=privateRoom();
 m=apply(m,'invite','alice',{friendUid:'bob'},1000).match;
 assert.throws(()=>apply(m,'accept','bob',{},301001),/expired/);
 m=apply(m,'decline','bob',{},2000).match;
 assert.equal(m.invites[0].status,'rejected');
 m=apply(m,'invite','alice',{friendUid:'bob'},302000).match;
 assert.equal(m.invites[0].status,'pending');
 assert.equal(m.invites[0].createdAt,302000);
 assert.equal(apply(m,'accept','bob',{},302001).match.players[1].uid,'bob');
});
