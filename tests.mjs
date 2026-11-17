import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,applyAction,legalActions,neighbors,captureTargets,centerOf,aiAction} from './public/game-engine.js';
for(const n of [5,7]){
 test(`${n}x${n} starts with correct board and moves`,()=>{const g=initialGame(n);assert.equal(g.board.length,n*n);assert.equal(legalActions(g).length,n*n-1);assert(!legalActions(g).some(a=>a.to===centerOf(n)));assert.equal(neighbors(0,n).length,2);});
 test(`${n}x${n} placement ends with correct stone counts`,()=>{
 let s=initialGame(n),turns=0;
 while(s.phase==='placement'&&turns++<60){const act=legalActions(s)[0];assert(act);const out=applyAction(s,s.turn,act);assert(out.ok);s=out.game;}
 assert.equal(s.phase,'movement');assert.deepEqual(s.placed,[(n*n-1)/2,(n*n-1)/2]);assert.equal(s.board[centerOf(n)],0);assert.equal(s.turn,1);
 });
 test(`${n}x${n} captures and center immunity`,()=>{
 const g=initialGame(n),to=n+1,middle=to+1,far=to+2;
 // The moved stone advances horizontally from above the destination into an enclosing line.
 const from=to-n;g.phase='movement';g.turn=0;g.board[from]=1;g.board[middle]=2;g.board[far]=1;
 const cap=captureTargets(g.board.map((v,i)=>i===to?1:i===from?0:v),to,0,n);
 assert.deepEqual(cap,[middle]);
 const r=applyAction(g,0,{kind:'move',from,to});assert(r.ok,r.error);assert.equal(r.game.board[middle],0);assert.equal(r.game.capturedBy[0],1);assert.equal(r.game.lastMove.captures.length,1);
 const center=centerOf(n);const board=Array(n*n).fill(0),left=center-1,right=center+1;
 board[center]=2;board[left]=1;board[right]=1;assert(!captureTargets(board,left,0,n).includes(center));
 });
 test(`${n}x${n} bot action is legal`,()=>{const s=initialGame(n);const a=aiAction(s,0);assert(legalActions(s).some(x=>x.to===a.to));});
}
test('rejects bad board sizes',()=>assert.throws(()=>initialGame(6)));