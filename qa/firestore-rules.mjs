import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,query,where,orderBy,startAt,endAt,setDoc,updateDoc,serverTimestamp,addDoc} from 'firebase/firestore';

test('FIRESTORE: two signed-in players, privacy, friends, chat, voice and match invitation lifecycle',async t=>{
 const env=await initializeTestEnvironment({projectId:'demo-seega-royale',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
 t.after(async()=>await env.cleanup());
 await env.clearFirestore();
 const alice=env.authenticatedContext('alice',{email:'alice@example.com',email_verified:true}).firestore();
 const bob=env.authenticatedContext('bob',{email:'bob@example.com',email_verified:true}).firestore();
 const stranger=env.authenticatedContext('eve',{email:'eve@example.com',email_verified:true}).firestore();
 const anon=env.unauthenticatedContext().firestore();
 const profile=(uid,id,name)=>({uid,id,name,nameLower:name.toLowerCase(),avatar:'🦁',photo:null,updatedAt:serverTimestamp()});
 const ref=(db,path)=>doc(db,path);

 await t.test('public profiles require signed-in owner to create',async()=>{
  await assertSucceeds(setDoc(ref(alice,'directory/alice'),profile('alice','SG-A1A1A1A1A1','Zeko')));
  await assertSucceeds(setDoc(ref(bob,'directory/bob'),profile('bob','SG-B2B2B2B2B2','Zezo')));
  await assertFails(setDoc(ref(stranger,'directory/alice'),profile('alice','SG-A1A1A1A1A1','Impersonator')));
  await assertFails(getDoc(ref(anon,'directory/alice')));
  await assertSucceeds(getDoc(ref(bob,'directory/alice')));
 });
 await t.test('prefix search after two letters finds multiple players',async()=>{
  const results=await assertSucceeds(getDocs(query(collection(alice,'directory'),orderBy('nameLower'),startAt('ze'),endAt('ze\uf8ff'))));
  assert.equal(results.docs.length,2);
 });
 await t.test('email directory only allows the authenticated email owner to claim it',async()=>{
  await assertSucceeds(setDoc(ref(alice,'emailIndex/alice@example.com'),{uid:'alice',id:'SG-A1A1A1A1A1',name:'Zeko'}));
  await assertFails(setDoc(ref(stranger,'emailIndex/alice@example.com'),{uid:'eve',id:'SG-E3E3E3E3E3',name:'Fake'}));
  const result=await assertSucceeds(getDoc(ref(bob,'emailIndex/alice@example.com')));
  assert.equal(result.data()?.uid,'alice');
 });
 await t.test('presence is visible to signed-in accounts, editable only by owner',async()=>{
  await assertSucceeds(setDoc(ref(alice,'presence/alice'),{uid:'alice',status:'online',roomCode:'',watchAllowed:false,lastSeen:serverTimestamp()}));
  await assertFails(setDoc(ref(stranger,'presence/alice'),{uid:'alice',status:'offline',roomCode:'',watchAllowed:false,lastSeen:serverTimestamp()}));
 });
 await t.test('friend request is authenticated, recipient may accept',async()=>{
  await assertSucceeds(setDoc(ref(alice,'friendRequests/alice__bob'),{fromUid:'alice',toUid:'bob',status:'pending',at:serverTimestamp()}));
  await assertFails(updateDoc(ref(alice,'friendRequests/alice__bob'),{status:'accepted'}));
  await assertSucceeds(updateDoc(ref(bob,'friendRequests/alice__bob'),{status:'accepted'}));
  const friends=await assertSucceeds(getDocs(query(collection(bob,'friendRequests'),where('toUid','==','bob'))));
  assert.equal(friends.docs.length,1);
 });
 await t.test('private direct messages require accepted friendship',async()=>{
  await assertSucceeds(addDoc(collection(alice,'dmThreads/alice__bob/messages'),{uid:'alice',text:'Hello',at:serverTimestamp()}));
  await assertFails(addDoc(collection(stranger,'dmThreads/alice__bob/messages'),{uid:'eve',text:'Intrusion',at:serverTimestamp()}));
  const view=await assertSucceeds(getDocs(query(collection(bob,'dmThreads/alice__bob/messages'),orderBy('at','desc'))));
  assert.equal(view.docs.length,1);
 });
 await t.test('friend inbox preserves recipient privacy',async()=>{
  await assertSucceeds(addDoc(collection(alice,'inbox/bob/items'),{fromUid:'alice',kind:'dm',text:'Message',roomCode:'',read:false,at:serverTimestamp(),pairId:'alice__bob'}));
  await assertFails(getDocs(collection(stranger,'inbox/bob/items')));
  const list=await assertSucceeds(getDocs(collection(bob,'inbox/bob/items')));
  assert.equal(list.docs.length,1);
  await assertSucceeds(updateDoc(ref(bob,'inbox/bob/items/'+list.docs[0].id),{read:true}));
 });
 await t.test('match challenge follows pending -> accepted with sender observation',async()=>{
  const item={fromUid:'alice',toUid:'bob',roomCode:'ABC123',fromName:'Zeko',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await assertSucceeds(setDoc(ref(alice,'matchInvites/alice__bob'),item));
  const incoming=await assertSucceeds(getDocs(query(collection(bob,'matchInvites'),where('toUid','==','bob'))));
  assert.equal(incoming.docs.length,1);
  await assertFails(updateDoc(ref(stranger,'matchInvites/alice__bob'),{status:'accepted',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref(bob,'matchInvites/alice__bob'),{status:'accepted',updatedAt:serverTimestamp()}));
  const sender=await assertSucceeds(getDoc(ref(alice,'matchInvites/alice__bob')));
  assert.equal(sender.data()?.status,'accepted');
 });
 await t.test('repeated invitation within 20 seconds is refused',async()=>{
  await assertFails(setDoc(ref(alice,'matchInvites/alice__bob'),{fromUid:'alice',toUid:'bob',roomCode:'DEF123',fromName:'Zeko',status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 });
 await t.test('public challenges are bounded and readable by the recipient',async()=>{
  await assertSucceeds(setDoc(ref(alice,'inbox/bob/items/alice'),{fromUid:'alice',kind:'invite',text:'Match?',roomCode:'ABC123',read:false,at:serverTimestamp(),pairId:''}));
  await assertFails(setDoc(ref(alice,'inbox/bob/items/alice'),{fromUid:'alice',kind:'invite',text:'Spam?',roomCode:'ABC123',read:false,at:serverTimestamp(),pairId:''}));
  await assertSucceeds(getDoc(ref(bob,'inbox/bob/items/alice')));
 });
 await t.test('compatibility voice calls use friend-only inbox notices when friendCalls rules are unavailable',async()=>{
  const callId='CallSecure1234567890';
  const invite={fromUid:'alice',kind:'notice',text:'VOICE_V1|CALL|'+callId+'|seegaroyal-voice-test',roomCode:'',read:false,at:serverTimestamp(),pairId:'alice__bob'};
  await assertSucceeds(addDoc(collection(alice,'inbox/bob/items'),invite));
  const messages=await assertSucceeds(getDocs(query(collection(bob,'inbox/bob/items'),orderBy('at','desc'))));
  assert.ok(messages.docs.some(d=>String(d.data().text).startsWith('VOICE_V1|CALL|')));
  await assertFails(addDoc(collection(stranger,'inbox/bob/items'),{...invite,fromUid:'eve',pairId:'eve__bob'}));
  await assertSucceeds(addDoc(collection(bob,'inbox/alice/items'),{
   fromUid:'bob',kind:'notice',text:'VOICE_V1|ACCEPT|'+callId,roomCode:'',read:false,at:serverTimestamp(),pairId:'alice__bob'
  }));
  const responses=await assertSucceeds(getDocs(query(collection(alice,'inbox/alice/items'),orderBy('at','desc'))));
  assert.ok(responses.docs.some(d=>String(d.data().text).includes('|ACCEPT|')));
 });
 await t.test('friend call signaling is allowed only for accepted friends',async()=>{
  await assertSucceeds(setDoc(ref(alice,'friendCalls/call1'),{fromUid:'alice',toUid:'bob',pairId:'alice__bob',peerId:'seegaroyal-voice-test',state:'ringing',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  const calls=await assertSucceeds(getDocs(query(collection(bob,'friendCalls'),where('toUid','==','bob'))));
  assert.equal(calls.docs.length,1);
  await assertFails(updateDoc(ref(stranger,'friendCalls/call1'),{state:'accepted',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref(bob,'friendCalls/call1'),{state:'accepted',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref(alice,'friendCalls/call1'),{state:'ended',updatedAt:serverTimestamp()}));
  assert.equal((await assertSucceeds(getDoc(ref(bob,'friendCalls/call1')))).data()?.state,'ended');
 });
 await t.test('no wallet manipulation or unrestricted document access',async()=>{
  await assertFails(setDoc(ref(alice,'players/alice'),{ownerUid:'alice',id:'SG-A1A1A1A1A1',name:'Zeko',avatar:'🦁',color:'ruby',settings:{sound:true,music:true},updatedAt:Date.now(),coins:99999}));
  await assertFails(setDoc(ref(stranger,'wallets/eve'),{coins:999999}));
  await assertFails(getDoc(ref(anon,'presence/alice')));
 });
});
