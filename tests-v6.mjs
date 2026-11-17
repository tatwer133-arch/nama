import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const get = p=>readFileSync(new URL(p,import.meta.url),'utf8');
const scene=get('./public/scene3d.js'),styles=get('./public/styles.css'),html=get('./public/index.html'),app=get('./public/app.js');

test('premium 3D board occupies almost full mobile width with an oblique camera',()=>{
 assert.match(scene,/const camera=\[0,11\.5,7\],at=\[0,0,\.90\]/);
 assert.match(styles,/aspect-ratio:1\.26\/1!important/);
 assert.match(styles,/width:100%!important;max-width:760px!important/);
 assert.match(styles,/background:#3a2416!important/);
});
test('3D pieces use beveled multi-layer lathe shapes and inlaid rings',()=>{
 assert.match(scene,/t\.annulus\(px,py\+\.188\*tile/);
 assert.match(scene,/t\.cylinder\(px,py\+\.122\*tile/);
 assert.match(scene,/gl\.DEPTH_TEST/);
 assert.match(scene,/wood-grain\.jpg\?v=8/);
 assert(statSync(new URL('./public/wood-grain.jpg',import.meta.url)).size>10000);
});
test('placement hints do not fill every empty tile with green dots',()=>{
 assert.match(scene,/game\.phase==='placement'\?\[\]/);
 assert.match(styles,/\[data-phase="placement"\] \.cell\.hint::after\{display:none\}/);
 assert.match(app,/data-phase="\$\{g\.phase\|\|'movement'\}"/);
});
test('opponent and player stay compact with the board between them',()=>{
 const section=styles.slice(styles.indexOf('/* V6 • Camera-first premium board.'));
 assert(section.includes('.duel-opponent-area'));
 assert(section.includes('.duel-self-area'));
 assert(section.includes('grid-template-columns:57px minmax(0,1fr)'));
 assert(section.includes('.chat-fab-zone'));
 const before=app.indexOf('<div class="duel-opponent-area">${playerChip(enemy,true)}');
 const board=app.indexOf('<div class="board-shell board3d is-tilted" data-phase=');
 const after=app.indexOf('<div class="duel-self-area">${playerChip(viewer,false)}');
 assert(before>=0&&board>before&&after>board);
});
test('reuses WebGL context between game turns for mobile stability',()=>{
 assert.match(scene,/let previous=null,active=null,shared=null/);
 assert.match(scene,/canvas\.removeEventListener\('pointerup',onPointer\)/);
 assert(!scene.includes("WEBGL_lose_context"));
});
test('cache-busted v6 assets are used in production',()=>{
 assert.match(html,/styles\.css\?v=(?:[89]|1[01])/);
 assert.match(html,/offline-adapter\.js\?v=(?:[89]|1[01])/);
 assert.match(get('./public/offline-adapter.js'),/await import\('\.\/app\.js\?v=11(?:\.[123])?'\)/);
});