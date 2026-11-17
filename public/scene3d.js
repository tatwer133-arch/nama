// Seega Royale V7 — cached low-overhead premium 3D renderer.
// All wood, brass and piece geometry is original and generated at runtime.
import {chineseLayout} from './variants.js';

const PALETTES={ruby:[.81,.16,.25],ocean:[.12,.40,.83],sun:[.98,.67,.13],jade:[.09,.67,.45]};
const vs=`attribute vec3 p;attribute vec3 n;attribute vec2 uv;attribute vec3 color;attribute float material;
uniform mat4 mvp;uniform vec3 camera;
varying vec3 vN,vP,vC;varying vec2 vUv;varying float vM;
void main(){vN=n;vP=p;vC=color;vUv=uv;vM=material;gl_Position=mvp*vec4(p,1.0);}`;
const fs=`precision mediump float;
varying vec3 vN,vP,vC;varying vec2 vUv;varying float vM;
uniform vec3 camera;
uniform sampler2D woodTexture;uniform float woodReady;
void main(){
 vec3 normal=normalize(vN),light=normalize(vec3(-.45,.88,.55));
 float diffuse=max(dot(normal,light),0.0);
 vec3 base=vC;
 if(vM<.5){
   // On mobile the shipped wood image provides the fine grain: avoid expensive
   // multi-frequency sine/noise calculations on every fragment.
   float grain=woodReady>.5
     ? texture2D(woodTexture,fract(vUv*.22)).r
     : .72+.12*sin(vUv.y*49.0+sin(vUv.x*2.0)*2.0);
   base*=clamp(.65+grain*.54,.67,1.20);
 }
 float shine=0.0;
 vec3 view=normalize(camera-vP);
 if(vM>1.5){
   // Softer balanced highlights make ceramic and gold edges look rounded.
   float highlight=max(dot(reflect(-light,normal),view),0.0);
   shine=pow(highlight,vM>2.5?36.0:24.0)*(vM>2.5?.24:.18);
 }
 float edgeLight=pow(1.0-max(dot(normal,view),0.0),2.0)*.055;
 base=base*(.47+diffuse*.49+edgeLight)+vec3(1.0,.91,.76)*shine;
 gl_FragColor=vec4(base,1.0);
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl){const p=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(n=>n/l);};
function look(eye,at){const z=norm(sub(eye,at)),x=norm(cross([0,1,0],z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
function multiply(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function clip(m,x,y,z){const p=[x,y,z,1],a=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)a[r]+=m[k*4+r]*p[k];return a;}
function shade(hex){if(Array.isArray(hex))return hex;return [((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];}
function mesh(){
 const pts=[],inds=[];
 function vertex(p,n,uv,col,mat){pts.push(...p,...n,...uv,...shade(col),mat);}
 function quad(a,b,c,d,col,mat=0,uvRange=[0,0,1,1]){
  const n=norm(cross(sub(b,a),sub(c,a)));const base=pts.length/12;
  vertex(a,n,[uvRange[0],uvRange[1]],col,mat);vertex(b,n,[uvRange[2],uvRange[1]],col,mat);
  vertex(c,n,[uvRange[2],uvRange[3]],col,mat);vertex(d,n,[uvRange[0],uvRange[3]],col,mat);
  inds.push(base,base+1,base+2,base,base+2,base+3);
 }
 function box(cx,cy,cz,w,h,d,col,mat=0){
  const x=cx-w/2,X=cx+w/2,y=cy-h/2,Y=cy+h/2,z=cz-d/2,Z=cz+d/2;
  quad([x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z],col,mat,[x,z,X,Z]);
  quad([x,y,Z],[x,y,z],[X,y,z],[X,y,Z],col,mat);
  quad([x,y,z],[x,Y,z],[X,Y,z],[X,y,z],col,mat);
  quad([X,y,Z],[X,Y,Z],[x,Y,Z],[x,y,Z],col,mat);
  quad([x,y,Z],[x,Y,Z],[x,Y,z],[x,y,z],col,mat);
  quad([X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z],col,mat);
 }
 function cylinder(cx,baseY,cz,radius,height,col,mat=2,segs=28,radiusTop=radius){
  const top=baseY+height;
  for(let i=0;i<segs;i++){const a=i*2*Math.PI/segs,b=(i+1)*2*Math.PI/segs;
   const c=Math.cos(a),s=Math.sin(a),C=Math.cos(b),S=Math.sin(b);
   quad([cx+radius*c,baseY,cz+radius*s],[cx+radiusTop*c,top,cz+radiusTop*s],[cx+radiusTop*C,top,cz+radiusTop*S],[cx+radius*C,baseY,cz+radius*S],col,mat,[i/segs,0,(i+1)/segs,1]);
   const center=[cx,top,cz],v1=[cx+radiusTop*c,top,cz+radiusTop*s],v2=[cx+radiusTop*C,top,cz+radiusTop*S];
   // Top-facing winding
   const base=pts.length/12;vertex(center,[0,1,0],[.5,.5],col,mat);vertex(v2,[0,1,0],[(C+1)/2,(S+1)/2],col,mat);vertex(v1,[0,1,0],[(c+1)/2,(s+1)/2],col,mat);inds.push(base,base+1,base+2);
  }
 }
 function annulus(cx,y,cz,outer,inner,col,mat=2,segs=24){
  for(let i=0;i<segs;i++){
   const a=i*2*Math.PI/segs,b=(i+1)*2*Math.PI/segs;
   const c=Math.cos(a),d=Math.sin(a),C=Math.cos(b),D=Math.sin(b);
   quad([cx+inner*c,y,cz+inner*d],[cx+inner*C,y,cz+inner*D],[cx+outer*C,y,cz+outer*D],[cx+outer*c,y,cz+outer*d],col,mat);
  }
 }
 function sphere(cx,cy,cz,r,col){const N=10,M=14;
  for(let j=0;j<N;j++){const th0=Math.PI*j/N,th1=Math.PI*(j+1)/N;
   for(let i=0;i<M;i++){const a=2*Math.PI*i/M,b=2*Math.PI*(i+1)/M;
    const pt=(th,az)=>[cx+r*Math.sin(th)*Math.cos(az),cy+r*Math.cos(th),cz+r*Math.sin(th)*Math.sin(az)];
    quad(pt(th0,a),pt(th0,b),pt(th1,b),pt(th1,a),col,3);
   }
  }
 }
 function append(template,x=0,dy=0,z=0){
  const start=pts.length/12,v=template.vertices,ids=template.indices;
  // All lighting normals / ring details were generated once in local space;
  // only translate the position attribute for each piece.
  for(let j=0;j<v.length;j+=12){
   pts.push(v[j]+x,v[j+1]+dy,v[j+2]+z,v[j+3],v[j+4],v[j+5],v[j+6],v[j+7],v[j+8],v[j+9],v[j+10],v[j+11]);
  }
  for(let j=0;j<ids.length;j++)inds.push(start+ids[j]);
 }
 return{pts,inds,quad,box,cylinder,sphere,annulus,append};
}
// GPU resources persist between moves. Only game-state changes upload a new
// piece mesh; the wooden table and texture are reused (not remeshed per frame).
let previous=null,active=null,shared=null;
const boardCache=new Map();
const pieceTemplates=new Map();

function initRenderer(){
 if(shared&&!shared.gl.isContextLost?.())return shared;
 const canvas=document.createElement('canvas');
 const quality=(navigator.hardwareConcurrency||4)>4&&(navigator.deviceMemory||4)>=4;
 const gl=canvas.getContext('webgl',{antialias:quality,alpha:false,preserveDrawingBuffer:false,depth:true,powerPreference:quality?'high-performance':'low-power'})
    ||canvas.getContext('experimental-webgl',{antialias:false,alpha:false});
 if(!gl)return null;
 let prog;
 try{prog=program(gl);}catch(e){console.warn('3D rendering unavailable',e);return null;}
 const attrs={};
 gl.useProgram(prog);
 for(const name of ['p','n','uv','color','material'])attrs[name]=gl.getAttribLocation(prog,name);
 const uniforms={mvp:gl.getUniformLocation(prog,'mvp'),camera:gl.getUniformLocation(prog,'camera'),wood:gl.getUniformLocation(prog,'woodTexture'),woodReady:gl.getUniformLocation(prog,'woodReady')};
 const buffer=()=>({vertices:gl.createBuffer(),indices:gl.createBuffer(),count:0});
 const base=buffer(),pieces=buffer(),overlays=buffer(),motion=buffer();
 const texture=gl.createTexture();
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([178,178,178,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 gl.clearColor(.23,.13,.075,1);
 shared={canvas,gl,prog,attrs,uniforms,base,pieces,overlays,motion,texture,woodReady:0,baseKey:null,piecesKey:null,redraw:null};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active?.dispose();active=null;shared=null;});
 const img=new Image();
 img.onload=()=>{
  if(shared?.canvas!==canvas||gl.isContextLost?.())return;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  const ext=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')||gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
  if(ext){const max=gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1;gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,max));}
  shared.woodReady=1;
  shared.redraw?.();
 };
 img.onerror=()=>console.info('Using lightweight procedural wood grain');
 img.src='/wood-grain.jpg?v=8';
 return shared;
}
function toGeometry(m){
 const vertexCount=m.pts.length/12;
 if(vertexCount>65535)throw Error('3D geometry exceeds 16-bit index limit: '+vertexCount);
 return {vertices:new Float32Array(m.pts),indices:new Uint16Array(m.inds)};
}
function upload(gl,buffer,geometry,usage){
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer.vertices);
 gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,usage);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer.indices);
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,usage);
 buffer.count=geometry.indices.length;
}
function paint(shared,buffer){
 if(!buffer.count)return;
 const {gl,attrs}=shared;
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer.vertices);
 const stride=48;
 for(const [name,size,offset] of [['p',3,0],['n',3,12],['uv',2,24],['color',3,32],['material',1,44]]){
  if(attrs[name]===-1)continue;
  gl.enableVertexAttribArray(attrs[name]);gl.vertexAttribPointer(attrs[name],size,gl.FLOAT,false,stride,offset);
 }
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer.indices);
 gl.drawElements(gl.TRIANGLES,buffer.count,gl.UNSIGNED_SHORT,0);
}
function pixelScale(mode,n){
 const cores=navigator.hardwareConcurrency||4, memory=navigator.deviceMemory||4;
 const lowEnd=cores<=4||memory<=3;
 // Sharper table edges and rounded stones on capable devices; remain lightweight on budget Android.
  const cap=mode==='chinese'||n>=9?(lowEnd?1:1.22):n>=7?(lowEnd?1.12:1.45):(lowEnd?1.30:1.85);
 return Math.min(cap,window.devicePixelRatio||1);
}
export function reset3D(){active?.dispose();active=null;previous=null;}
export function mount3D(room){
 active?.dispose();active=null;
 const shell=document.querySelector('.room-card .board-shell.board3d'),grid=shell?.querySelector('.board,.chinese-board');
 if(!shell||!grid||!room?.game)return;
 const r=initRenderer();
 if(!r){shell.classList.add('royale-webgl-fallback');return;}
 const {gl,canvas,prog,uniforms}=r;
 canvas.className='royale-webgl';canvas.setAttribute('aria-label','طاولة لعب ثلاثية الأبعاد؛ اضغط على الحجر ثم موقع الحركة');
 shell.prepend(canvas);shell.classList.add('royale-webgl-active');
 const game=room.game,mode=game.variant||'seega',chinese=mode==='chinese';
 const n=chinese?0:(mode==='seega3'||mode.startsWith('seega'))?(game.size||5):8;
 const boardId=room.id+':'+mode,prior=previous?.id===boardId?previous:null;
 const prevBoard=prior?.board,move=game.lastMove;
 const hasMotion=(move?.from!==null&&move?.from!==undefined)||!!move?.captures?.length;
 const anim=prior&&move&&hasMotion&&prior.moves!==game.moves&&prevBoard
   ?{start:performance.now(),from:move.from,to:move.to,captures:move.captures||[],before:prevBoard}:null;
 previous={id:boardId,moves:game.moves,board:[...game.board]};
 const cells=Array.from(grid.querySelectorAll('[data-cell]'));
 const hints=new Set(game.phase==='placement'?[]:cells.filter(x=>x.classList.contains('hint')).map(x=>Number(x.dataset.cell)));
 const selected=new Set(cells.filter(x=>x.classList.contains('selected')).map(x=>Number(x.dataset.cell)));
 const positions=chinese?chineseLayout.map(v=>({x:v.x*.61,z:v.y*.56})):
  game.board.map((v,i)=>({x:((i%n)+.5-n/2)*(8.25/n),z:(Math.floor(i/n)+.5-n/2)*(8.25/n)}));
 const tile=8.25/(n||9),rad=chinese?.245:tile*.325;
 // 9x9 stones are only ~20px across on phones: 14-sided lathe remains smooth
 // on screen while avoiding the 65k-vertex WebGL1 limit of the old renderer.
 const segs=chinese?16:n>=9?14:n>=7?20:30;
 const camera=[0,11.5,7],at=[0,0,.90],view=look(camera,at);
 let matrix=multiply(perspective(Math.PI*41/180,1,.12,75),view);
 const key=mode+':'+(n||0);
 function makeBoard(){
  const m=mesh();
  m.box(0,-1.05,0,32,.16,32,[.235,.125,.075],0);
  m.box(0,-.70,0,10.30,.58,10.30,[.115,.058,.038],0);
  m.box(0,-.43,0,10.15,.14,10.15,[.42,.235,.13],0);
  m.box(0,-.33,0,9.96,.10,9.96,[.76,.51,.26],1);
  m.box(0,-.25,0,9.79,.09,9.79,[.13,.07,.046],0);
  m.box(0,-.16,0,9.51,.12,9.51,[.43,.215,.105],0);
  m.box(0,-.075,0,8.72,.09,8.72,[.83,.63,.36],1);
  m.box(0,-.013,0,8.49,.085,8.49,[.145,.074,.045],0);
  if(!chinese){
   for(let i=0;i<game.board.length;i++){
    const row=Math.floor(i/n),col=i%n,pos=positions[i];
    const dark=(row+col)%2===1,checkers=mode==='american'||mode==='russian';
    let c=checkers?(dark?[.27,.125,.073]:[.88,.705,.50]):(dark?[.37,.188,.11]:[.87,.695,.46]);
    if(mode.startsWith('seega')&&i===(n*n-1)/2)c=[.51,.31,.185];
    m.box(pos.x,.048,pos.z,tile-.009,.046,tile-.009,c,0);
    if(i===(n*n-1)/2&&mode.startsWith('seega'))m.annulus(pos.x,.079,pos.z,tile*.23,tile*.17,[.76,.51,.25],2,24);
   }
  }else{
   m.box(0,.04,0,8.35,.06,8.35,[.63,.398,.23],0);
   for(const pos of positions){m.cylinder(pos.x,.085,pos.z,.17,.01,[.17,.09,.055],0,12);m.cylinder(pos.x,.099,pos.z,.11,.009,[.38,.21,.13],0,12);}
  }
  for(const a of [-1,1])for(const b of [-1,1]){
   m.cylinder(a*4.54,-.075,b*4.54,.072,.065,[.86,.62,.28],2,12);
   m.annulus(a*4.54,-.004,b*4.54,.038,.020,[.21,.12,.07],2,12);
  }
  return toGeometry(m);
 }
 // This cache is shared across all turns. No per-frame geometry for the table.
 if(!boardCache.has(key))boardCache.set(key,makeBoard());
 if(r.baseKey!==key){upload(gl,r.base,boardCache.get(key),gl.STATIC_DRAW);r.baseKey=key;}
 function addPiece(m,value,x,y,z){
  const seat=(value-1)%2,tone=room.players?.[seat]?.color||(['ruby','ocean'][seat]);
  const color=PALETTES[tone]||PALETTES[seat?'ocean':'ruby'];
  const templateKey=[mode,n,tone,value>=3?'king':'plain'].join(':');
  let template=pieceTemplates.get(templateKey);
  if(!template){
   const t=mesh(),px=0,py=.12,pz=0;
   if(chinese)t.sphere(px,py+rad*.72,pz,rad*.8,color);
   else{
    const deep=color.map(c=>Math.max(.045,c*.48)),light=color.map(c=>Math.min(1,c*1.23+.035));
    t.cylinder(px,.085,pz,rad*1.055,.012,[.065,.045,.035],1,12);
    t.cylinder(px,py,pz,rad,.128*tile,deep,3,segs,rad*.985);
    t.cylinder(px,py+.122*tile,pz,rad*.972,.048*tile,color,3,segs,rad*.903);
    t.cylinder(px,py+.165*tile,pz,rad*.855,.019*tile,light,3,segs);
    t.annulus(px,py+.188*tile,pz,rad*.803,rad*.705,light.map(c=>Math.min(1,c*.90)),2,segs);
    t.annulus(px,py+.191*tile,pz,rad*.59,rad*.55,deep.map(c=>Math.min(1,c*1.4)),2,segs);
    t.cylinder(px,py+.182*tile,pz,rad*.48,.011*tile,color,3,segs);
    if(value>=3)t.cylinder(px,py+.210*tile,pz,rad*.31,.038*tile,[.98,.77,.29],2,segs);
   }
   template=toGeometry(t);pieceTemplates.set(templateKey,template);
  }
  m.append(template,x,y-.12,z);
 }
 const piecesKey=mode+':'+n+':'+game.board.join(',')+':'+room.players?.map(p=>p?.color||'').join(',')+':'+(anim?.from!==null&&anim?.from!==undefined?anim.to:'all');
 if(r.piecesKey!==piecesKey){
  const staticPieces=mesh();
  for(let i=0;i<game.board.length;i++){
   const v=game.board[i],p=positions[i];if(!v)continue;
   if(anim&&anim.from!==null&&anim.from!==undefined&&anim.to===i)continue;
   addPiece(staticPieces,v,p.x,.12,p.z);
  }
  upload(gl,r.pieces,toGeometry(staticPieces),gl.DYNAMIC_DRAW);
  r.piecesKey=piecesKey;
 }
 // Selection rings and possible moves are tiny, separate meshes. Changing the
 // selected cell never rebuilds/reuploads 80 detailed stones on a 9x9 board.
 if(hints.size||selected.size){
  const overlay=mesh();
  for(const i of hints){if(game.board[i])continue;const p=positions[i];if(p)overlay.cylinder(p.x,.11,p.z,chinese?.11:tile*.09,.035,[.15,.94,.66],2,12);}
  for(const i of selected){const p=positions[i];if(p)overlay.cylinder(p.x,.082,p.z,rad*1.13,.023,[1.0,.87,.38],2,14);}
  upload(gl,r.overlays,toGeometry(overlay),gl.DYNAMIC_DRAW);
 }else r.overlays.count=0;
 let raf=0,disposed=false,lastRender=0;
 const moving=anim&&anim.from!==null&&anim.from!==undefined&&positions[anim.to]&&positions[anim.from];
 function motionGeometry(progress){
  const m=mesh();
  if(moving){
   const from=positions[anim.from],to=positions[anim.to];
   const smooth=progress*progress*(3-2*progress);
   const x=from.x+(to.x-from.x)*smooth,z=from.z+(to.z-from.z)*smooth;
   const y=.12+Math.sin(Math.PI*progress)*.49;
   const v=game.board[anim.to];
   if(v)addPiece(m,v,x,y,z);
  }
  if(anim&&progress<1){
   for(const i of anim.captures){
    if(game.board[i])continue;
    const v=anim.before[i],p=positions[i];if(!v||!p)continue;
    const color=PALETTES[room.players?.[(v-1)%2]?.color]||PALETTES.ocean;
    const s=Math.max(.001,1-progress);
    if(chinese)m.sphere(p.x,.23+(1-s)*.5,p.z,rad*s*.78,color);
    else m.cylinder(p.x,.12+(1-s)*.35,p.z,rad*s,.14*tile*s,color,3,segs);
   }
  }
  return toGeometry(m);
 }
 let hitLayer=null;
 const lowEnd=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=3;
 const scale=pixelScale(mode,n),fps=chinese||n>=9?(lowEnd?30:50):n>=7?(lowEnd?40:60):60;
 function draw(now,force=false){
  if(disposed||!canvas.isConnected)return;
  if(!force&&lastRender&&now-lastRender<1000/fps-2){raf=requestAnimationFrame(t=>draw(t));return;}
  lastRender=now;
  const width=Math.max(1,Math.round(canvas.clientWidth)),height=Math.max(1,Math.round(canvas.clientHeight));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);matrix=multiply(perspective(Math.PI*41/180,width/height,.12,75),view);if(typeof syncChineseHits==='function')syncChineseHits();}
  gl.useProgram(prog);
  gl.uniformMatrix4fv(uniforms.mvp,false,new Float32Array(matrix));
  gl.uniform3fv(uniforms.camera,new Float32Array(camera));
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,r.texture);
  gl.uniform1i(uniforms.wood,0);gl.uniform1f(uniforms.woodReady,r.woodReady);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  paint(r,r.base);paint(r,r.pieces);paint(r,r.overlays);
  const progress=anim?Math.min(1,(now-anim.start)/780):1;
  if(moving||anim?.captures?.length){upload(gl,r.motion,motionGeometry(progress),gl.DYNAMIC_DRAW);paint(r,r.motion);}
  if(progress<1)raf=requestAnimationFrame(t=>draw(t));
 }
 draw(performance.now(),true);
 r.redraw=()=>draw(performance.now(),true);
 // Transparent projected touch targets solve tiny-hitbox taps on the 121-hole
 // Chinese star, while leaving the scene fully 3D. They use the same camera
 // matrix as the renderer, so visual holes and interactive targets align.
 function syncChineseHits(){
  if(!chinese||!hitLayer||!hitLayer.isConnected)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  [...hitLayer.children].forEach((button,i)=>{
   const p=positions[i],v=clip(matrix,p.x,.12,p.z);
   if(v[3]<=0){button.hidden=true;return;}
   button.hidden=false;
   button.style.left=((v[0]/v[3]+1)*w/2)+'px';
   button.style.top=((1-v[1]/v[3])*h/2)+'px';
  });
 }
 if(chinese){
  hitLayer=document.createElement('div');hitLayer.className='chinese-hit-layer';
  for(let i=0;i<positions.length;i++){
   const btn=document.createElement('button');btn.type='button';btn.className='chinese-hit';
   btn.setAttribute('aria-label','حجر أو خانة '+(i+1));
   btn.dataset.cell=String(i);
   btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();grid.querySelector(`[data-cell="${i}"]`)?.click();});
   hitLayer.append(btn);
  }
  shell.append(hitLayer);syncChineseHits();
 }
 const onPointer=e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
  let nearest=-1,dist=Infinity;
  for(let i=0;i<positions.length;i++){
   const p=positions[i],v=clip(matrix,p.x,.12,p.z);if(v[3]<=0)continue;
   const cx=(v[0]/v[3]+1)/2,cy=(1-v[1]/v[3])/2;
   const d=Math.hypot((x-cx)*rect.width,(y-cy)*rect.height);
   if(d<dist){dist=d;nearest=i;}
  }
  const maxDist=chinese?Math.max(25,Math.min(40,rect.width*.092)):Math.max(11,Math.min(32,rect.width/Math.max(3,n)*.72));
  if(nearest>=0&&dist<=maxDist)grid.querySelector(`[data-cell="${nearest}"]`)?.click();
 };
 canvas.addEventListener('pointerup',onPointer);
 const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(!disposed)draw(performance.now(),true);}):null;
 resizeObserver?.observe(canvas);
 active={redraw:()=>draw(performance.now(),true),dispose(){disposed=true;cancelAnimationFrame(raf);resizeObserver?.disconnect();hitLayer?.remove();canvas.removeEventListener('pointerup',onPointer);if(r.redraw)r.redraw=null;}};
}