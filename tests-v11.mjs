import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const auth=fs.readFileSync(new URL('./public/firebase-auth.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
test('Google login is independent of Firestore profile synchronization',()=>{
 assert.match(app,/Authentication succeeded; a missing Firestore database must not trap/);
 assert.doesNotMatch(app,/if\(u\?\.firebaseUid\)throw Error\('دخلت بالحساب/);
 assert.match(app,/state\.cloud=\{online:false/);
});
test('Mobile OAuth has clear recovery instructions',()=>{
 assert.match(auth,/auth\/popup-blocked/);
 assert.match(auth,/auth\/unauthorized-domain/);
 assert.match(auth,/auth\/operation-not-supported-in-this-environment/);
 assert.match(auth,/seega-royale-eg\.vercel\.app/);
});
test('Failed CDN loading may retry rather than keeping rejected promise',()=>{
 assert.match(auth,/authInit=null;throw err/);
});
test('V11 cache paths are updated',()=>{
 assert.match(html,/styles\.css\?v=11/);
 assert.match(html,/offline-adapter\.js\?v=11/);
});