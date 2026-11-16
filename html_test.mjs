import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initialGame} from './public/game-engine.js';
const el={addEventListener(){},classList:{add(){},remove(){},toggle(){}},value:'',innerHTML:''};
globalThis.document={querySelector:()=>el,querySelectorAll:()=>[],addEventListener:()=>{}};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window={scrollTo(){},location:{pathname:'/'}};
const src=fs.readFileSync('./public/app.js','utf8');
const start=src.indexOf('(async function boot()');
if(start<0)throw Error('boot not found');
fs.writeFileSync('./public/.app-test.mjs',src.slice(0,start)+'\nexport {renderHome,renderRoom,renderProfile,renderRanking,state};\n');
try{
 const {renderHome,renderRoom,renderProfile,renderRanking,state}=await import('./public/.app-test.mjs');
 const me={id:'SG-1234567890',name:'Tester',color:'ruby',avatar:'🦁',photo:null,coins:2500,gems:50,xp:100,wins:2,losses:1,draws:0,totalCaptures:3,bestCaptures:2,leagueTier:0,inventory:['classic'],equipped:'classic',contacts:[],settings:{sound:true},season:{week:'2026-11-16',points:200,wins:1,captures:2,games:1}};
 state.me=me;state.store=[{id:'classic',name:'كلاسيكي'}];state.config={gifts:[{id:'egg',name:'بيض',emoji:'🥚',price:10}]};
 const home=renderHome();assert(home.includes('data-size="7"'));assert(home.includes('data-action="local"'));
 const profile=renderProfile();assert(profile.includes('id="gallery-photo"'));assert(profile.includes(me.id));assert(profile.includes('data-color="jade"'));
 const ranking=renderRanking();assert(ranking.includes('دوري الأسبوع'));assert(ranking.includes('الترتيب العالمي الحقيقي'));
 state.room={id:'BOT001',kind:'bot',status:'playing',players:[me,{id:'bot',name:'bot',color:'ocean',equipped:'classic',avatar:'🤖'}],game:initialGame(7),chat:[]};
 const room=renderRoom();assert.equal((room.match(/data-cell="\d+"/g)||[]).length,49);assert(room.includes('data-gift="egg"'));assert(room.includes('--board-size:7'));assert(room.includes('data-seat="1"'));
 console.log('Home, profile, ranking and 7x7 board template tests passed.');
}finally{fs.unlinkSync('./public/.app-test.mjs')}