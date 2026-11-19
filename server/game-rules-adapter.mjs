/**
 * Adapter for the EXACT existing Seega Royale engines. The server, never
 * the browser, picks and validates every move. No variant rules are rewritten.
 */
import {initialGame,legalActions,applyAction,aiAction} from '../public/game-engine.js';
import {initialVariant,variantActions,variantApply,variantAI,GAME_CATALOG} from '../public/variants.js';
const allModes=new Set(GAME_CATALOG.map(x=>x.id));
const egyptian=mode=>/^seega(?:5|7|9)$/.test(mode);
export const serverGameRules=Object.freeze({
 init(mode){
  if(!allModes.has(mode))throw Error('Game mode is unavailable');
  return egyptian(mode)?initialGame(Number(mode.slice(5))):initialVariant(mode);
 },
 legal(game,player){
  return game.variant?variantActions(game,player):legalActions(game,player);
 },
 apply(game,player,action){
  return game.variant?variantApply(game,player,action):applyAction(game,player,action);
 },
 auto(game,player,legal){
  const proposed=game.variant?variantAI(game,player):aiAction(game,player);
  const match=legal.find(x=>x.kind===proposed?.kind&&x.to===proposed.to&&(x.kind==='place'||x.from===proposed.from));
  return match||legal[0];
 }
});
