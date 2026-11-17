import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const social=read('./public/cloud-social.js');
const app=read('./public/app.js');
const html=read('./public/index.html');
const adapter=read('./public/offline-adapter.js');
const rules=read('./firestore.rules');

test('friend requests create a missing document without a forbidden pre-read',()=>{
 const start=social.indexOf('export async function cloudSendFriendRequest(');
 const end=social.indexOf('export async function cloudRespondFriend(',start);
 assert.ok(start>0&&end>start);
 const section=social.slice(start,end);
 assert.doesNotMatch(section,/fs\.getDoc\(ref\)/);
 assert.match(section,/fs\.setDoc\(ref/);
 assert.match(section,/permission-denied/);
 assert.match(rules,/match \/friendRequests\/\{pairId\}/);
 assert.match(rules,/allow create: if signed\(\)/);
});

test('changing direct message contact removes old listeners',()=>{
 assert.match(social,/stopFns\.splice\(i,1\)\[0\]/);
 assert.match(social,/info\.dm=\[\];info\.dmOther=otherUid;push\(\)/);
});

test('direct message success is independent of notification delivery',()=>{
 assert.match(social,/await fs\.addDoc\(fs\.collection\(db,'dmThreads'/);
 assert.match(social,/await cloudSendInbox\(otherUid,'dm'/);
 assert.match(social,/\.catch\(e=>onNotice/);
});

test('guest profile editing does not trigger cloud account operations',()=>{
 assert.match(app,/if\(path==='\/me'&&firebaseReady\(\)&&out\.user\?\.firebaseUid\)/);
});

test('all changed modules and HTML use cache-busted V11.1 imports',()=>{
 assert.match(html,/styles\.css\?v=11\.1/);
 assert.match(html,/offline-adapter\.js\?v=11\.1/);
 assert.match(adapter,/app\.js\?v=11\.1/);
 assert.match(app,/cloud-social\.js\?v=11\.1/);
 assert.match(app,/cloud-profile\.js\?v=11\.1/);
 assert.match(social,/firebase-auth\.js\?v=11\.1/);
});

test('private player data is protected by explicit default-deny rules',()=>{
 assert.match(rules,/match \/players\/\{uid\}/);
 assert.match(rules,/allow get: if own\(uid\)/);
 assert.match(rules,/allow read,write: if false/);
});
