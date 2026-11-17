import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const src=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');

test('Firebase app config is connected to user supplied project without private credentials',async()=>{
 const {firebaseConfig}=await import('./public/firebase-config.js');
 assert.equal(firebaseConfig.projectId,'seega-royal');
 assert.equal(firebaseConfig.authDomain,'seega-royal.firebaseapp.com');
 assert.equal(firebaseConfig.appId,'1:157983788177:web:1aeaf837f1280ee6850330');
 assert.ok(firebaseConfig.apiKey.startsWith('AIza'));
 assert.equal(Object.isFrozen(firebaseConfig),true);
 const configSource=src('./public/firebase-config.js');
 assert.doesNotMatch(configSource,/-----BEGIN PRIVATE KEY-----|service_account|private_key|client_secret/i);
});

test('V10 loads fresh assets and Firebase web Auth',()=>{
 const html=src('./public/index.html'),adapter=src('./public/offline-adapter.js'),app=src('./public/app.js');
 assert.match(html,/styles\.css\?v=10/);
 assert.match(html,/offline-adapter\.js\?v=10/);
 assert.match(adapter,/await import\('\.\/app\.js\?v=10'\)/);
 assert.match(app,/scene3d\.js\?v=10/);
 assert.match(app,/firebaseEmail\(/);
 assert.match(app,/cloudReadOrCreate\(/);
 assert.match(app,/cloudSocialStart\(/);
 assert.match(src('./public/firebase-auth.js'),/firebase-config\.js\?v=10/);
});

test('Cloud profile uses authenticated uid and stable id, not client controlled wallet',()=>{
 const profile=src('./public/cloud-profile.js');
 assert.match(profile,/auth\.currentUser/);
 assert.match(profile,/stableId\(u\.uid\)/);
 assert.match(profile,/mod\.doc\(db,'players',u\.uid\)/);
 assert.doesNotMatch(profile,/coins:|gems:|wallet:/);
});

test('Firestore authorization rules exist for social and accounts, default deny',()=>{
 const rules=src('./firestore.rules');
 for(const name of ['players','directory','emailIndex','friendRequests','presence','publicChat','inbox','dmThreads'])
   assert.ok(rules.includes(`match /${name}`),`${name} rules missing`);
 assert.ok(rules.includes('allow read,write: if false'));
 assert.doesNotMatch(rules,/allow (?:read|write|create|update|delete): if true/);
});