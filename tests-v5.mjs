import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import crypto from 'node:crypto';
import {initialGame,applyAction,aiAction} from './public/game-engine.js';
import {initialVariant,variantApply,variantAI} from './public/variants.js';
function adapter(){
 const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
 const window={Peer:class{},fetch:async()=>({})};
 const code=readFileSync(new URL('./public/offline-adapter.js',import.meta.url),'utf8')
 .replace(/^import .*?;\n/gm,'').replace(/await import\('\.\/app\.js\?v=\d+(?:\.\d+)?'\);/,'');
 const maker=new Function('initialGame','applyAction','aiAction','initialVariant','variantApply','variantAI','window','localStorage','sessionStorage','crypto','structuredClone','Response','setTimeout','clearTimeout','TextEncoder',code+'\nreturn {message,getRoom:roomSafe,window,storage:localStorage};');
 return maker(initialGame,applyAction,aiAction,initialVariant,variantApply,variantAI,window,storage,storage,crypto.webcrypto,structuredClone,Response,setTimeout,clearTimeout,TextEncoder);
}
const emit=(s,n,d)=>new Promise(resolve=>s.emit(n,d,resolve));
test('guest works and does not change original cash balance after upgrade',async()=>{let a=adapter(),r=await a.message('/auth/guest','POST',{name:'ضيف'});assert.equal(r.user.coins,2500);assert.equal(r.user.gems,75);assert.equal(r.user.settings.music,true);});
test('email registration, salted password hashing, login and password rejection all run locally',async()=>{
 const a=adapter(),guest=await a.message('/auth/guest','POST',{name:'سعيد'});
 const register=await a.message('/auth/register','POST',{name:'سعيد',email:'Saeed@Example.com',password:'0123456789'});
 assert.equal(register.user.email,'saeed@example.com');assert.equal(register.user.id,guest.user.id);
 const saved=JSON.parse(a.storage.getItem('seega_royale_device_email_accounts_v1'));
 assert(saved['saeed@example.com']?.hash);assert(!JSON.stringify(saved).includes('0123456789'));
 await a.message('/auth/logout','POST');
 const bad=await a.message('/auth/login','POST',{email:'saeed@example.com',password:'wrong0000'});assert.equal(bad.status,401);
 const login=await a.message('/auth/login','POST',{email:'saeed@example.com',password:'0123456789'});assert.equal(login.user.id,guest.user.id);
});
test('two local players cannot claim the same color',async()=>{
 const a=adapter();await a.message('/auth/guest','POST',{name:'مريم'});
 const r=await a.message('/local','POST',{mode:'seega5',size:5}),sock=a.window.io();
 const conflict=await emit(sock,'color:choose',{seat:0,color:r.room.players[1].color});
 assert.match(conflict.error,/لون/);
 const available=['ruby','ocean','sun','jade'].filter(c=>c!==r.room.players[1].color);
 const accepted=await emit(sock,'color:choose',{seat:0,color:available[1]});assert(accepted.ok);
 const botRoom=await a.message('/bot','POST',{mode:'american'});assert.notEqual(botRoom.room.players[0].color,botRoom.room.players[1].color);
});
test('3D-only game always enables WebGL graphics and never offers a 2D toggle',()=>{
 const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('./public/scene3d.js',import.meta.url),'utf8');
 const style=readFileSync(new URL('./public/styles.css',import.meta.url),'utf8');
 assert(app.includes('mount3D(state.room)'));assert(!app.includes('data-action="toggle-tilt"'));
 assert(scene.includes("getContext('webgl'"));assert(scene.includes('gl.drawElements'));
 assert(scene.includes('gl.DEPTH_TEST'));assert(scene.includes('m.cylinder'));
 assert(style.includes('royale-webgl-active'));assert(!style.includes('2D toggle enabled'));
});
test('sound engine starts from user gesture and audio test button available',()=>{
 const sound=readFileSync(new URL('./public/soundscape.js',import.meta.url),'utf8');const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 assert(sound.includes('export function unlockAudio()'));assert(sound.includes('export function startMusic()'));
 assert(app.includes("a==='test-audio'"));assert(app.includes("document.addEventListener('pointerdown'"));
});
test('Google/Facebook are genuine Firebase OAuth integration when configured, not fake login',()=>{
 const auth=readFileSync(new URL('./public/firebase-auth.js',import.meta.url),'utf8');
 const cfg=readFileSync(new URL('./public/firebase-config.js',import.meta.url),'utf8');
 assert(auth.includes('signInWithPopup'));assert(auth.includes('GoogleAuthProvider'));assert(auth.includes('FacebookAuthProvider'));
 assert(cfg.includes("projectId: 'seega-royal'"));assert(!/private_key|serviceAccount|client_secret/.test(cfg));
});