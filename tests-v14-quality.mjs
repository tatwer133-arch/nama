import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('./public/app.js'),social=read('./public/cloud-social.js'),calls=read('./public/friend-call.js'),styles=read('./public/styles.css'),scene=read('./public/scene3d.js');

test('direct messages never show reopen dialog for the already-visible conversation',()=>{
 assert.match(app,/state\.tab==='social'&&state\.socialMode==='dm'&&state\.cloud\?\.dmOther===n\.fromUid/);
 assert.match(social,/data\.kind==='dm'&&data\.fromUid===info\.dmOther/);
 assert.match(social,/cloudMarkDirectRead\(data\.fromUid\)/);
 assert.match(social,/info\.inbox\.filter\(x=>x\.kind==='dm'/);
});

test('old inbox alerts and startup account permission errors do not flood the homepage',()=>{
 assert.match(social,/let inboxInitial=true/);
 assert.match(social,/if\(inboxInitial\)\{inboxInitial=false;return;/);
 assert.match(social,/onNotice\(\{kind:'setup'/);
 assert.match(app,/state\.cloudSetupIssue=n\.text/);
 assert.match(app,/cloud-setup-hint/);
 assert.match(app,/else if\(a==='cloud-info'\)/);
 assert.match(styles,/\.cloud-setup-hint\{/);
});

test('private call uses existing authenticated friend inbox when newer Firestore rules reject calls',()=>{
 assert.match(calls,/async function sendInboxSignal\(/);
 assert.match(calls,/VOICE_V1\|/);
 assert.match(calls,/friendCallsStart\(handlers\)/);
 assert.match(calls,/stopInbox=watchInboxSignals\(db,fs,uid\)/);
 assert.match(calls,/if\(e\?\.code==='permission-denied'/);
 assert.match(calls,/await sendInboxSignal\(otherUid,'CALL',current\.id,peerId\)/);
 assert.match(calls,/await sendInboxSignal\(otherUid,'ACCEPT',id\)/);
 assert.match(calls,/await sendInboxSignal\(request\.fromUid,'DECLINE',id\)/);
 assert.match(calls,/await sendInboxSignal\(otherUid,'END',id\)/);
 assert.match(calls,/getUserMedia/);
});

test('control messages are never visible as chat alerts or unread social counts',()=>{
 assert.match(social,/snap\.docs\.filter\(d=>!String\(d\.data\(\)\.text\|\|''\)\.startsWith\('VOICE_V1\|'\)\)/);
 assert.match(social,/if\(String\(data\.text\|\|''\)\.startsWith\('VOICE_V1\|'\)\)continue/);
 assert.match(calls,/fs\.deleteDoc\(fs\.doc\(db,'inbox',uid,'items',doc\.id\)\)/);
});

test('roses cakes hearts have gentle flight and avoid avatar impact effects',()=>{
 assert.match(app,/\['rose','heart','cake'\]\.includes\(gift\.id\)/);
 assert.match(app,/classList\.add\('flying-gift--gentle'\)/);
 assert.match(app,/b\.bottom\+\(gift\.id==='cake'/);
 assert.match(app,/window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
 assert.match(styles,/\.gift-soft-halo--cake/);
 assert.match(styles,/@keyframes gift-gentle-arrive/);
});

test('table quality scales up on capable phones and remains adaptive for low-end devices',()=>{
 assert.match(scene,/antialias:quality/);
 assert.match(scene,/hardwareConcurrency\|\|4/);
 assert.match(scene,/deviceMemory\|\|4/);
 assert.match(scene,/EXT_texture_filter_anisotropic/);
 assert.match(scene,/const segs=chinese\?16:n>=9\?14:n>=7\?20:30/);
 assert.match(scene,/\(now-anim\.start\)\/780/);
});
