import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,apply,center,legalSteps,capturedFrom} from '../game.mjs';

test('5x5 starts empty, middle immune to placement, 12 each',()=>{
 const g=newGame();assert.equal(g.board.length,25);assert.equal(center(g),12);
 assert.throws(()=>apply(g,0,{type:'place',at:12}),/مش متاحة/);
 const a=apply(g,0,{type:'place',at:0});assert.equal(a.placed[0],1);
 assert.equal(a.turn,0);assert.equal(a.board[0],0);
 assert.equal(g.board[0],null,'mutations are immutable');
 assert.equal(apply(a,0,{type:'place',at:1}).turn,1);
});
test('placement finishes, second player starts movement (5x5)',()=>{
 let g=newGame(5,2);
 for(let k=0;k<12;k++)for(let i=0;i<2;i++){
  const at=g.board.findIndex((x,p)=>x===null&&p!==12);
  g=apply(g,g.turn,{type:'place',at});
 }
 assert.equal(g.phase,'movement');assert.equal(g.turn,1);
 assert.deepEqual(g.placed,[12,12]);assert.equal(g.board[12],null);
});
test('7x7 one stone per turn, 24 per player',()=>{
 let g=newGame(7,1);
 for(let i=0;i<48;i++){let at=g.board.findIndex((v,j)=>v===null&&j!==24);g=apply(g,g.turn,{type:'place',at});}
 assert.equal(g.phase,'movement');assert.equal(g.turn,1);assert.deepEqual(g.placed,[24,24]);
});
test('orthogonal movement only',()=>{
 let g=newGame();g={...g,phase:'movement',board:Array(25).fill(null),turn:0};g.board[6]=0;
 assert.deepEqual(legalSteps(g,6,0).sort((a,b)=>a-b),[1,5,7,11]);
 assert.throws(()=>apply(g,0,{type:'move',from:6,to:12}),/خطوة واحدة/);
 assert.equal(apply(g,0,{type:'move',from:6,to:7}).board[7],0);
});
test('sandwich captures only on moving stone; middle immune',()=>{
 let g=newGame();g={...g,phase:'movement',board:Array(25).fill(null),turn:0};
 g.board[0]=0;g.board[1]=1;g.board[7]=0; // move 7 -> 2 captures 1 between 0 and 2
 let h=apply(g,0,{type:'move',from:7,to:2});
 assert.equal(h.board[1],null);assert.equal(h.captured[0],1);
 assert.equal(h.winner,0);
 let centerGame=newGame();centerGame={...centerGame,phase:'movement',board:Array(25).fill(null),turn:0};
 centerGame.board[10]=0;centerGame.board[12]=1;centerGame.board[18]=0;
 let mid=apply(centerGame,0,{type:'move',from:18,to:17});
 assert.equal(mid.board[12],1,'middle cannot be captured');
});
test('capture chain can be declined using endChain',()=>{
 let g=newGame();g={...g,phase:'movement',board:Array(25).fill(null),turn:0};
 // 2->7 captures #8 between #7 and #9; 7->12 captures #13 between #12 and #14.
 g.board[2]=0;g.board[8]=1;g.board[9]=0;g.board[13]=1;g.board[14]=0;g.board[21]=1;
 let h=apply(g,0,{type:'move',from:2,to:7});
 assert.deepEqual(h.last.removed,[8]);assert.equal(h.forcedFrom,7);assert.equal(h.turn,0);
 let hh=apply(h,0,{type:'endChain'});assert.equal(hh.turn,1);
});
test('a blocked opponent is skipped',()=>{
 let g=newGame();g={...g,phase:'movement',board:Array(25).fill(null),turn:0};
 g.board[0]=0;g.board[24]=1;g.board[19]=0;g.board[23]=0;
 let h=apply(g,0,{type:'move',from:0,to:1});
 assert.equal(h.turn,0,'blocked player 1 was passed');
});
test('invalid player and wrong turn rejected',()=>{
 const g=newGame();assert.throws(()=>apply(g,1,{type:'place',at:0}),/استنى دورك/);
 assert.throws(()=>apply(g,0,{type:'place',at:0.1}),/مش متاحة/);
});
test('when second player has no legal move after placement, first plays',()=>{
 let g=newGame(5,2);
 const neighbors=[7,11,13,17];
 while(g.phase==='placement'){
  const at=g.board.findIndex((x,i)=>x===null&&i!==12&&(g.turn===0?neighbors.includes(i)||g.placed[0]>=4:!neighbors.includes(i)));
  const fallback=g.board.findIndex((x,i)=>x===null&&i!==12);
  g=apply(g,g.turn,{type:'place',at:at<0?fallback:at});
 }
 assert.equal(g.phase,'movement');
 assert.equal(g.turn,0,'player one gets the turn when second is blocked');
});
