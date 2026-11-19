import test from 'node:test';
import assert from 'node:assert/strict';
import {serverGameRules} from '../server/game-rules-adapter.mjs';
import {GAME_CATALOG} from '../public/variants.js';
for(const item of GAME_CATALOG){
 test('server game adapter keeps original rules: '+item.id,()=>{
  const game=serverGameRules.init(item.id);
  const legal=serverGameRules.legal(game,game.turn);
  assert.ok(Array.isArray(legal)&&legal.length>0);
  const choice=serverGameRules.auto(game,game.turn,legal);
  assert.ok(legal.some(x=>x.kind===choice.kind&&x.to===choice.to&&x.from===choice.from));
  const result=serverGameRules.apply(game,game.turn,choice);
  assert.equal(result.ok,true);
  assert.notDeepEqual(result.game.board,game.board);
  if(item.id==='chinese'){
   assert.equal(game.board.length,121);
   assert.equal(game.board.filter(x=>x===1).length,10);
   assert.equal(game.board.filter(x=>x===2).length,10);
  }
 });
}
test('3×3 legal movement after six placements changes selected stone',()=>{
 let state=serverGameRules.init('seega3');
 for(let i=0;i<6;i++){
  const legal=serverGameRules.legal(state,state.turn);
  const action=legal.find(a=>{
    const board=state.board.slice();board[a.to]=state.turn+1;
    // Avoid accidental three-in-a-row while building the test position.
    const rows=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return !rows.some(r=>r.every(k=>board[k]===state.turn+1));
  }) || legal[0];
  const r=serverGameRules.apply(state,state.turn,action);
  assert.equal(r.ok,true);state=r.game;
 }
 assert.equal(state.phase,'movement');assert.equal(state.winner,null);
 const action=serverGameRules.legal(state,state.turn).find(a=>a.kind==='move');
 assert.ok(action);
 const result=serverGameRules.apply(state,state.turn,action);
 assert.equal(result.ok,true);assert.equal(result.game.board[action.from],0);
 assert.equal(result.game.board[action.to],state.turn+1);
});
test('unsupported types cannot pass to an unrecognized engine',()=>assert.throws(()=>serverGameRules.init('seega999')));
