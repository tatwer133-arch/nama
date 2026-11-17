import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mount3D,reset3D} from './public/scene3d.js';

// Deterministic canvas/WebGL1 stand-in: verifies drawing geometry and buffer
// reuse without depending on GPU support in CI/headless Chromium.
const stats={contexts:0,programs:0,texture:0,buffers:[],draws:0,raf:[]};
let now=1000,canvas;
const gl=new Proxy({}, {get(obj,key){
 if(key==='isContextLost')return()=>false;
 if(key==='createProgram')return()=>{stats.programs++;return {};};
 if(key==='createTexture')return()=>{stats.texture++;return {};};
 if(key==='createBuffer'||key==='createShader')return()=>({});
 if(key==='getShaderParameter'||key==='getProgramParameter')return()=>true;
 if(key==='getShaderInfoLog'||key==='getProgramInfoLog')return()=>'';
 if(key==='getAttribLocation')return(_,name)=>['p','n','uv','color','material'].indexOf(name);
 if(key==='getUniformLocation')return()=>({});
 if(key==='bufferData')return(_,data,usage)=>{stats.buffers.push({length:data.length,usage});};
 if(key==='drawElements')return(_,count)=>{assert(count>0);stats.draws++;};
 if(typeof key==='string'&&/^[A-Z0-9_]+$/.test(key))return 1;
 return()=>{};
}});
const grid={querySelectorAll(){return Array.from({length:grid.n},(_,i)=>({dataset:{cell:String(i)},classList:{contains:name=>name==='selected'&&i===grid.selected}}));},querySelector(){return {click(){}};},n:81,selected:-1};
const shell={classList:{add(){}},querySelector(){return grid;},prepend(c){c.isConnected=true;},append(c){c.isConnected=true;}};
globalThis.document={querySelector(){return shell;}};
globalThis.window={devicePixelRatio:3};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:4,deviceMemory:2}});
globalThis.requestAnimationFrame=fn=>{stats.raf.push(fn);return stats.raf.length;};
globalThis.cancelAnimationFrame=()=>{};
globalThis.performance={now:()=>now};
globalThis.ResizeObserver=class {observe(){}disconnect(){}};
globalThis.Image=class {set src(v){this.url=v;this.onload?.();}};
document.createElement=(tag)=>{if(tag!=='canvas')return {style:{},dataset:{},children:[],isConnected:false,setAttribute(){},addEventListener(){},removeEventListener(){},append(c){this.children.push(c);c.isConnected=true;},remove(){this.isConnected=false;}};stats.contexts++;canvas={getContext:type=>type==='webgl'?gl:null,isConnected:false,clientWidth:420,clientHeight:332,width:0,height:0,className:'',setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:420,height:332};}};return canvas;};
function room(n,mode='seega'+n){
 const len=mode==='chinese'?121:n*n;
 grid.n=len;
 return{id:'ROOM',game:{variant:mode,size:n,phase:'movement',board:Array.from({length:len},(_,i)=>mode==='chinese'?(i<10?1:i>=len-10?2:0):i===Math.floor(len/2)?0:(i%2)+1),moves:0,lastMove:null},players:[{color:'ruby'},{color:'ocean'}]};
}

test('9x9 full 80-stone board draws within WebGL1 index limits',()=>{
 const r=room(9);assert.doesNotThrow(()=>mount3D(r));
 assert(stats.draws>0);assert.equal(canvas.width,420,'low-memory phones draw native CSS-sized pixels instead of 3x DPR');
 assert(stats.buffers.every(x=>x.length>0));
 assert.equal(stats.raf.length,0,'idle game does not run continuous RAF loop');
});
test('static board, shader and wood texture are reused on every turn',()=>{
 const first={contexts:stats.contexts,programs:stats.programs,texture:stats.texture};
 stats.buffers.length=0;
 mount3D(room(9));
 assert.equal(stats.contexts,first.contexts);
 assert.equal(stats.programs,first.programs);
 assert.equal(stats.texture,first.texture);
 assert.equal(stats.buffers.length,0,'unchanged board and GPU resources need no new vertex/index upload');
});
test('selecting a 9x9 stone updates only its tiny highlight overlay',()=>{
 grid.selected=12;stats.buffers.length=0;
 mount3D(room(9));
 assert.equal(stats.buffers.length,2,'only selection vertex and index buffers change');
 assert(stats.buffers[0].length<5000,'overlay mesh remains tiny');
 grid.selected=-1;
});

test('animation changes only moving stone buffers — never reconstructs 9x9 board',()=>{
 const r=room(9);
 r.game.board[0]=0;r.game.board[40]=0;
 r.game.lastMove={from:0,to:40,captures:[]};r.game.moves=1;
 stats.buffers.length=0;stats.raf.length=0;
 mount3D(r);
 
 assert.equal(stats.buffers.length,4,'2 uploads for changed stones and 2 for first animation frame');
 assert(stats.raf.length>0);
 stats.buffers.length=0;
 now+=45;stats.raf.shift()(now);
 assert.equal(stats.buffers.length,2,'subsequent animation frame updates moving piece only');
});
test('placement move does not trigger an unnecessary 690ms redraw loop',()=>{
 reset3D();const r=room(9);r.game.phase='placement';
 mount3D(r);stats.raf.length=0;
 r.game.board[0]=1;r.game.moves=1;r.game.lastMove={from:null,to:0,captures:[]};
 now+=100;mount3D(r);
 assert.equal(stats.raf.length,0,'placed stones should appear instantly without idle animation');
});

test('all board variants stay under 16-bit mesh cap and use one WebGL context',()=>{
 for(const [n,mode] of [[5,'seega5'],[7,'seega7'],[9,'seega9'],[8,'american'],[8,'russian'],[11,'chinese']]){
  now+=1000;assert.doesNotThrow(()=>mount3D(room(n,mode)));
 }
 assert.equal(stats.contexts,1);
});
test('source applies low-overhead shader, LOD, GPU caching and cache v7',()=>{
 const scene=readFileSync(new URL('./public/scene3d.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 assert.match(scene,/const boardCache=new Map\(\)/);
 assert.match(scene,/r\.baseKey!==key/);
 assert.match(scene,/n>=9\?12:n>=7\?16:22/);
 assert.match(scene,/lowEnd\?30:45/);
 assert.match(scene,/gl\.STATIC_DRAW/);
 assert.match(scene,/r\.piecesKey!==piecesKey/);
 assert.match(scene,/const pieceTemplates=new Map\(\)/);
 assert.match(scene,/paint\(r,r\.base\);paint\(r,r\.pieces\);/);
 assert(!scene.includes('sin(vUv.y*205.0'));
 assert(html.includes('styles.css?v=8'));
 assert(app.includes('if(!state.room)reset3D()'));
});