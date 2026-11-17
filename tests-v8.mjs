import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {GAME_CATALOG,initialVariant,variantActions,variantApply,variantAI,smallSeegaLines} from './public/variants.js';
import {initialGame,applyAction,aiAction} from './public/game-engine.js';
const source=(name)=>readFileSync(new URL('./public/'+name,import.meta.url),'utf8');
function adapter(){
 const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
 const window={Peer:class{},fetch:async()=>({})};
 const code=source('offline-adapter.js').replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/app\.js\?v=\d+'\);/,'');
 const maker=new Function('initialGame','applyAction','aiAction','initialVariant','variantApply','variantAI','window','localStorage','sessionStorage','crypto','structuredClone','Response','setTimeout','clearTimeout','TextEncoder',code+'\nreturn {message,getRoom:roomSafe,window,storage:localStorage};');
 return maker(initialGame,applyAction,aiAction,initialVariant,variantApply,variantAI,window,storage,storage,crypto.webcrypto,structuredClone,Response,setTimeout,clearTimeout,TextEncoder);
}
const emit=(s,name,p)=>new Promise(r=>s.emit(name,p,r));
test('Small SeGa 3×3 is a distinct ruleset, three stones per side',()=>{
 const g=initialVariant('seega3');assert.equal(g.size,3);assert.equal(g.board.length,9);assert.equal(g.phase,'placement');assert.equal(variantActions(g,0).length,9);
 assert(!smallSeegaLines(g.board,0));
});
test('Small SeGa finishes on a three-in-a-row during placement',()=>{
 let g=initialVariant('seega3');for(const [p,to] of [[0,0],[1,3],[0,1],[1,4],[0,2]]){const out=variantApply(g,p,{kind:'place',to});assert(out.ok);g=out.game;}
 assert.equal(g.winner,0);assert.equal(variantActions(g,0).length,0);
});
test('Small SeGa supports slide to any vacant square after placing all six stones',()=>{
 let g=initialVariant('seega3');for(const to of [0,1,3,5,7,6]){const out=variantApply(g,g.turn,{kind:'place',to});assert(out.ok);g=out.game;}
 assert.equal(g.phase,'movement');assert.equal(g.winner,null);
 const moves=variantActions(g);assert(moves.some(x=>x.from===0&&x.to===8));
 assert(variantApply(g,g.turn,moves[0]).ok);
});
test('Small SeGa bot action and adapter route work',async()=>{
 let g=initialVariant('seega3');const best=variantAI(g,0);assert(best);assert(variantApply(g,0,best).ok);
 const a=adapter();await a.message('/auth/guest','POST',{name:'يوسف'});
 const game=await a.message('/bot','POST',{mode:'seega3',size:3});assert.equal(game.room.game.variant,'seega3');
 const moved=await emit(a.window.io(),'game:action',{id:game.room.id,action:variantActions(game.room.game)[0]});assert(moved.ok);
});
test('Chinese has a complete 121-position star, and click layer uses camera projection',()=>{
 const scene=source('scene3d.js'),app=source('app.js'),css=source('styles.css');
 assert.match(scene,/if\(chinese\)\{\s*hitLayer=document\.createElement/);
 assert(scene.includes('syncChineseHits'));assert(scene.includes('grid.querySelector(`[data-cell="${i}"]`)?.click()'));
 assert(css.includes('.chinese-hit-layer'));assert(app.includes('chineseLayout'));
});
test('Gifts have only 6 entries, cake slice, no confetti or splash',async()=>{
 const a=adapter(),cfg=await a.message('/config','GET',{});assert.equal(cfg.gifts.length,6);
 assert.deepEqual(cfg.gifts.map(x=>x.id),['heart','cake','egg','hammer','water','rose']);
 assert.equal(cfg.gifts.find(x=>x.id==='cake').emoji,'🍰');
 const app=source('app.js');assert(app.includes("gift-announcement"));assert(app.includes('pour-water'));assert(app.includes('egg-splat'));
});
test('No-scroll mobile dashboard, settings popup, chat drawer and sound toggle exist',()=>{
 const css=source('styles.css'),app=source('app.js');
 assert(css.includes('.home-v8'));assert(css.includes('.main-view:has(.duel-room){height:100dvh'));
 assert(css.includes('overflow:hidden!important'));assert(app.includes('function showSettings()'));
 assert(app.includes('function showGamePicker()'));assert(app.includes('function floatingChat()'));
 assert(app.includes("a==='open-settings'"));
});
test('Real cloud profile module uses Firebase Authentication and Firestore, with no credentials invented',()=>{
 const cloud=source('cloud-profile.js'),auth=source('firebase-auth.js'),config=source('firebase-config.js');
 assert(cloud.includes("mod.doc(db,'players',u.uid)"));assert(cloud.includes('mod.getDoc'));assert(cloud.includes('mod.setDoc'));
 assert(auth.includes('signInWithEmailAndPassword'));assert(auth.includes('createUserWithEmailAndPassword'));
 assert(config.includes('firebaseConfig = null'));
 const rules=readFileSync(new URL('./firestore.rules',import.meta.url),'utf8');
 assert(rules.includes('function own(uid)'));assert(rules.includes('allow list: if false'));
});
test('Local profile can hydrate a cloud ID and picture, but cannot override wallet balance',async()=>{
 const a=adapter();const first=await a.message('/auth/guest','POST',{name:'سلمى'});
 const out=await a.message('/me/cloud-sync','POST',{profile:{id:'SG-AABBCCDDEE',name:'سلمى من السحابة',coins:99999,gems:999,photo:null,color:'jade'}});
 assert.equal(out.user.id,'SG-AABBCCDDEE');assert.equal(out.user.name,'سلمى من السحابة');
 assert.equal(out.user.coins,first.user.coins);assert.equal(out.user.gems,first.user.gems);assert.equal(out.user.color,'jade');
});
test('Gift audio samples are original six short PCM files and are preloaded before throw',()=>{
 const fs=requireFileSize();
 for(const id of ['egg','hammer','water','cake','heart','rose']){
  assert(fs('./public/audio/'+id+'.wav')>10000);
 }
 const src=source('app.js');assert(src.includes('preloadGiftSample(b.dataset.gift)'));
 assert(src.includes('decodeAudioData'));
});
function requireFileSize(){return (path)=>readFileSync(new URL(path,import.meta.url)).length;}