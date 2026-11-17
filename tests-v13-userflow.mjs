import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const app=s('./public/app.js'),social=s('./public/cloud-social.js'),invites=s('./public/match-invites.js'),calls=s('./public/friend-call.js'),adapter=s('./public/offline-adapter.js'),rules=s('./firestore.rules'),css=s('./public/styles.css');

test('two-letter suggestions are debounced and update only results without losing input focus',()=>{
 assert.match(app,/document\.addEventListener\('input'/);
 assert.match(app,/value\.trim\(\)\.length<2/);
 assert.match(app,/setTimeout\(\(\)=>cloudSearchIncremental\(value\),260\)/);
 assert.match(app,/req!==state\.searchRequestId/);
 assert.match(app,/panel\.innerHTML=cloudSearchRows\(result\)/);
 assert.match(social,/fs\.startAt\(prefix\)/);
 assert.match(social,/nameLower/);
});

test('already accepted or pending friend requests do not show an Add button',()=>{
 assert.match(app,/relation==='friend'\?'<span class="pill">✓ عندك في الأصدقاء<\/span>'/);
 assert.match(app,/relation==='sent'\?'<span class="pill">📨 الطلب اتبعت<\/span>'/);
 assert.match(app,/relation==='incoming'\?'<span class="pill">📬 بعت لك طلب<\/span>'/);
 assert.match(social,/info\.sentRequests/);
 assert.match(social,/if\(info\.friends\.some\(x=>x\.uid===otherUid\)\)/);
});

test('incoming challenges are persisted, shown in friends, and require explicit acceptance',()=>{
 assert.match(app,/function matchInviteRows\(/);
 assert.match(app,/data-action="match-accept"/);
 assert.match(app,/data-action="match-reject"/);
 assert.match(app,/data-action="decline-invite"/);
 assert.match(invites,/export async function matchRespond/);
 assert.match(invites,/status:accept\?'accepted':'rejected'/);
 assert.match(invites,/LIFETIME_MS=5\*60\*1000/);
});

test('recipient confirms a match only after P2P connection actually succeeds',()=>{
 const action=app.indexOf("else if(a==='match-accept')");
 const end=app.indexOf("else if(a==='match-reject')",action);
 assert.ok(action>0&&end>action);
 const body=app.slice(action,end);
 assert.ok(body.indexOf('joinInvitedRoom(code,b)')<body.indexOf('matchRespond(id,true)'));
 assert.match(app,/async function joinInvitedRoom\(/);
 assert.match(app,/لم نقدر ندخل المباراة/);
 assert.match(adapter,/const timer=setTimeout\(\(\)=>reject\(Error\('الغرفة مش متاحة/);
});

test('outbound challenge updates and cancel are restricted to correct participants',()=>{
 assert.match(invites,/fs\.doc\(db,'matchInvites',me\+'__'\+uid\)/);
 assert.match(invites,/export async function matchCancel\(/);
 assert.match(app,/state\.outgoingMatchId=await matchCreate/);
 assert.match(app,/await matchCancel\(state\.outgoingMatchId\)/);
 assert.match(rules,/match \/matchInvites\/\{inviteId\}/);
 assert.match(rules,/status in \['accepted','rejected'\]/);
});

test('friend calls have clear permission errors and hang up if audio never connects',()=>{
 assert.match(calls,/Missing or insufficient permissions/);
 assert.match(calls,/Firebase → Firestore Database → Rules/);
 assert.match(calls,/getUserMedia/);
 assert.match(calls,/25000/);
 assert.match(calls,/friendCallHangup/);
 assert.match(rules,/match \/friendCalls\/\{callId\}/);
});

test('match voice uses consent, opens microphones and has local mute without hanging up',()=>{
 assert.match(app,/else if\(a==='accept-call'\)/);
 assert.match(app,/await startVoiceSession\(\)/);
 assert.match(app,/roomVoiceMuted=!state\.roomVoiceMuted/);
 assert.match(app,/t\.enabled=!state\.roomVoiceMuted/);
 assert.match(app,/data-action="room-voice-mute"/);
 assert.match(app,/await requestVoice\(\)/);
 assert.match(css,/room-voice-mute/);
});

test('red nav badge counts friend requests, private messages and pending matches',()=>{
 assert.match(app,/state\.cloud\.unread\|\|0/);
 assert.match(app,/state\.matchInvites\|\|\[\]/);
 assert.match(app,/social-alert-badge/);
 assert.match(social,/info\.unread=info\.requests\.length/);
});

test('mobile UI retains browser, app navigation, 3D board and privacy boundaries',()=>{
 const html=s('./public/index.html'),scene=s('./public/scene3d.js');
 assert.match(html,/offline-adapter\.js\?v=11\.[34]/);
 assert.match(html,/styles\.css\?v=11\.[34]/);
 assert.match(app,/mount3D\(state\.room\)/);
 assert.match(scene,/canvas\.addEventListener\('pointerup',onPointer\)/);
 assert.match(css,/@media\s*\(max-width:380px\)/);
 assert.match(rules,/match \/\{document=\*\*\} \{allow read,write: if false;\}/);
});
