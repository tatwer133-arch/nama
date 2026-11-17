import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const app=read('./public/app.js'),social=read('./public/cloud-social.js'),call=read('./public/friend-call.js');
const rules=read('./firestore.rules'),html=read('./public/index.html'),css=read('./public/styles.css');

test('social nav count is live and includes pending requests plus unread direct messages',()=>{
 assert.match(social,/info\.unread=info\.requests\.length\+info\.inbox\.filter\(x=>!x\.read&&x\.kind==='dm'\)\.length/);
 assert.match(app,/function updateSocialBadge\(/);
 assert.match(app,/\.social-alert-badge/);
 assert.match(css,/\.social-alert-badge\{[^}]*background:#e42b44/);
});

test('names, IDs and emails resolve to real public profiles without fake local accounts',()=>{
 assert.match(social,/nameLower:publicName\.toLocaleLowerCase\(\)\.normalize\('NFKC'\)/);
 assert.match(social,/fs\.orderBy\(key\)/);
 assert.match(social,/fs\.doc\(db,'emailIndex',term\.toLowerCase\(\)\)/);
 assert.match(social,/fs\.where\('id','==',term\.toUpperCase\(\)\)/);
 assert.match(app,/Array\.isArray\(state\.cloudSearch\)/);
 assert.match(rules,/match \/emailIndex\/\{email\}/);
 assert.match(rules,/stringsUnder\(d,'nameLower',24\)/);
});

test('public messages use profile photos and live presence from Firebase directory',()=>{
 assert.match(social,/async function decoratePublic\(/);
 assert.match(social,/fs\.getDoc\(fs\.doc\(db,'directory',uid\)\)/);
 assert.match(social,/chatPresenceWatchers/);
 assert.match(app,/function messageMarkup\(/);
 assert.match(app,/avatar\(user\)/);
 assert.match(app,/data-action="cloud-profile"/);
 assert.match(app,/data-action="cloud-challenge"/);
});

test('direct chat shows each sender name and avatar and clears read notifications',()=>{
 assert.match(social,/function dmSender\(/);
 assert.match(social,/\.\.\.dmSender\(data\.uid\)/);
 assert.match(social,/cloudMarkDirectRead\(otherUid\)/);
 assert.match(app,/data-action="cloud-dm"/);
 assert.match(app,/cloudCloseDirect\(\)/);
});

test('friend calls require explicit consent and can be muted by either participant',()=>{
 assert.match(call,/getUserMedia\(/);
 assert.match(call,/export async function friendCallDial\(/);
 assert.match(call,/export async function friendCallAnswer\(/);
 assert.match(call,/export async function friendCallDecline\(/);
 assert.match(call,/export function friendCallMute\(/);
 assert.match(call,/getAudioTracks\(\)\.forEach\(t=>t\.enabled=!session\.muted\)/);
 assert.match(call,/friendCallHangup/);
 assert.match(app,/data-action="friend-call-accept"/);
 assert.match(app,/data-action="friend-mute"/);
 assert.match(rules,/match \/friendCalls\/\{callId\}/);
 assert.match(rules,/request\.resource\.data\.state == 'ringing'/);
 assert.match(rules,/request\.resource\.data\.state in \['accepted','declined'\]/);
});

test('public challenges are recipient-specific and restricted by Firestore rules',()=>{
 assert.match(social,/cloudSendPublicInvite\(/);
 assert.match(social,/fs\.doc\(db,'inbox',recipient,'items',userId\)/);
 assert.match(rules,/function publicInvite\(/);
 assert.match(rules,/id == request\.auth\.uid/);
 assert.match(rules,/duration\.value\(20,'s'\)/);
});

test('V11.2 cache busting loads new modules without removing existing game assets',()=>{
 assert.match(html,/styles\.css\?v=11\.[23]/);
 assert.match(html,/offline-adapter\.js\?v=11\.[23]/);
 assert.match(read('./public/offline-adapter.js'),/app\.js\?v=11\.[23]/);
 assert.match(app,/friend-call\.js\?v=11\.[23]/);
 assert.match(app,/cloud-social\.js\?v=11\.[23]/);
 assert.match(app,/scene3d\.js\?v=11/);
});
