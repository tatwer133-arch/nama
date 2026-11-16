// Seega Royale V5 — dependency-free WebGL 3D tabletop renderer.
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
float rand(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
 vec3 normal=normalize(vN),light=normalize(vec3(-.45,.88,.55)),view=normalize(camera-vP);
 float diffuse=max(dot(normal,light),0.0);
 float fill=.32+diffuse*.64;
 vec3 base=vC;
 if(vM<.5){
   float grain=sin(vUv.y*92.0+sin(vUv.x*18.0)*3.5+sin(vUv.y*23.0)*1.5);
   float fine=sin(vUv.y*335.0+vUv.x*27.0)*.38;
   float noise=(rand(floor(vUv*vec2(110.0,180.0)))-.5)*.08;
   base*=1.0+(grain*.042+fine*.025+noise);
 }
 float gloss=pow(max(dot(reflect(-light,normal),view),0.0),vM>1.5?38.0:70.0)*(vM>1.5?.44:.12);
 if(vM>2.5)gloss+=pow(max(dot(reflect(-light,normal),view),0.0),8.0)*.12;
 base=base*fill+vec3(1.0,.87,.62)*gloss;
 float vignette=1.0-clamp(length(vP.xz)/25.0,0.0,.2);
 gl_FragColor=vec4(pow(base*vignette,vec3(.88)),1.0);
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
  quad([x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z],col,mat,[0,0,w,d]);
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
 function sphere(cx,cy,cz,r,col){const N=14,M=20;
  for(let j=0;j<N;j++){const th0=Math.PI*j/N,th1=Math.PI*(j+1)/N;
   for(let i=0;i<M;i++){const a=2*Math.PI*i/M,b=2*Math.PI*(i+1)/M;
    const pt=(th,az)=>[cx+r*Math.sin(th)*Math.cos(az),cy+r*Math.cos(th),cz+r*Math.sin(th)*Math.sin(az)];
    quad(pt(th0,a),pt(th0,b),pt(th1,b),pt(th1,a),col,3);
   }
  }
 }
 return{pts,inds,quad,box,cylinder,sphere};
}
let previous=null,active=null;
export function reset3D(){active?.dispose();active=null;previous=null;}
export function mount3D(room){
 active?.dispose();active=null;
 const shell=document.querySelector('.room-card .board-shell.board3d'),grid=shell?.querySelector('.board,.chinese-board');
 if(!shell||!grid||!room?.game)return;
 const canvas=document.createElement('canvas');canvas.className='royale-webgl';canvas.setAttribute('aria-label','طاولة لعب ثلاثية الأبعاد؛ اضغط على الحجر ثم موقع الحركة');
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false,depth:true,powerPreference:'default'})||canvas.getContext('experimental-webgl',{antialias:true,alpha:false});
 if(!gl){shell.classList.add('royale-webgl-fallback');return;}
 let prog;try{prog=program(gl);}catch(e){console.warn('3D rendering unavailable',e);return;}
 shell.prepend(canvas);shell.classList.add('royale-webgl-active');
 const pBuf=gl.createBuffer(),iBuf=gl.createBuffer(),attrs={};
 gl.useProgram(prog);for(const name of ['p','n','uv','color','material'])attrs[name]=gl.getAttribLocation(prog,name);
 const uMvp=gl.getUniformLocation(prog,'mvp'),uCamera=gl.getUniformLocation(prog,'camera');
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 gl.clearColor(.085,.058,.078,1);
 const game=room.game,mode=game.variant||'seega',chinese=mode==='chinese',n=chinese?0:mode.startsWith('seega')?(game.size||5):8;
 const boardId=room.id+':'+mode,prior=previous?.id===boardId?previous:null;
 const prevBoard=prior?.board,move=game.lastMove;
 const anim=prior&&move&&prior.moves!==game.moves&&prevBoard?{start:performance.now(),from:move.from,to:move.to,seat:move.player,captures:move.captures||[],before:prevBoard}:null;
 previous={id:boardId,moves:game.moves,board:[...game.board]};
 const interactive=Array.from(grid.querySelectorAll('[data-cell]'));
 const hints=new Set(interactive.filter(x=>x.classList.contains('hint')).map(x=>Number(x.dataset.cell)));
 const selected=new Set(interactive.filter(x=>x.classList.contains('selected')).map(x=>Number(x.dataset.cell)));
 const center=chinese?[0,0]:[0,0];
 const camera=[0,11.8,15.8],at=[0,-.35,0];
 const view=look(camera,at);
 const positions=chinese?chineseLayout.map(v=>({x:v.x*.61,z:v.y*.56})):
  game.board.map((v,i)=>({x:((i%n)+.5-n/2)*(8.25/n),z:(Math.floor(i/n)+.5-n/2)*(8.25/n)}));
 const tile=8.25/(n||9);
 const proj=perspective(Math.PI*40/180,1,.12,75);
 let matrix=multiply(proj,view),raf=0,disposed=false,lastWidth=0;
 function fillGeometry(progress){
  const m=mesh();
  m.box(0,-1.08,0,12,.32,13,[.20,.12,.10]); // velvet felt table
  m.box(0,-.65,0,9.88,.56,9.88,[.16,.067,.037]);
  m.box(0,-.38,0,9.6,.17,9.6,[.48,.29,.13]);
  m.box(0,-.25,0,9.43,.15,9.43,[.75,.54,.27],1);
  m.box(0,-.16,0,9.15,.2,9.15,[.24,.105,.054]);
  m.box(0,-.065,0,8.49,.10,8.49,[.80,.57,.32],1);
  m.box(0,-.01,0,8.3,.1,8.3,[.19,.097,.065]);
  if(!chinese){
   for(let i=0;i<game.board.length;i++){
    const r=Math.floor(i/n),c=i%n,pos=positions[i];
    const checkers=mode==='american'||mode==='russian',dark=(r+c)%2===1;
    let col=checkers?(dark?[.32,.17,.115]:[.85,.675,.45]):(dark?[.73,.49,.295]:[.84,.64,.395]);
    if(mode.startsWith('seega')&&i===(n*n-1)/2)col=[.47,.305,.205];
    m.box(pos.x,.048,pos.z,tile-.025,.046,tile-.025,col,0);
    if(i===(n*n-1)/2&&mode.startsWith('seega'))m.cylinder(pos.x,.08,pos.z,tile*.2,.013,[.71,.51,.25],1,24);
   }
  }else{
   m.box(0,.04,0,8.35,.06,8.35,[.61,.386,.214],0);
   for(const pos of positions){m.cylinder(pos.x,.085,pos.z,.17,.01,[.17,.09,.055],0,16);m.cylinder(pos.x,.099,pos.z,.11,.009,[.38,.21,.13],0,16);}
  }
  // inset brass studs and corner plates
  for(const a of [-1,1])for(const b of [-1,1]){
   m.cylinder(a*4.48,.015,b*4.48,.072,.065,[.86,.62,.28],2,16);
  }
  const rad=chinese?.245:tile*.325;
  for(let i=0;i<game.board.length;i++){
   const value=game.board[i],pos=positions[i];
   if(hints.has(i)&&!value){m.cylinder(pos.x,.11,pos.z,chinese?.11:tile*.09,.035,[.15,.94,.66],2,18);}
   if(selected.has(i)){m.cylinder(pos.x,.082,pos.z,rad*1.13,.023,[1.0,.87,.38],2,26);}
   if(!value)continue;
   const seat=(value-1)%2,color=PALETTES[room.players?.[seat]?.color]||PALETTES[seat?'ocean':'ruby'];
   let x=pos.x,z=pos.z,y=.12,scale=1;
   if(anim&&progress<1&&anim.to===i&&anim.from!==null&&anim.from!==undefined){
    const origin=positions[anim.from];if(origin){const smooth=progress*progress*(3-2*progress);x=origin.x+(pos.x-origin.x)*smooth;z=origin.z+(pos.z-origin.z)*smooth;y=.12+Math.sin(Math.PI*progress)*.64;}
   }
   m.cylinder(x,.083,z,rad*1.04,.015,[.05,.035,.029],1,24); // contact shadow
   if(chinese){m.sphere(x,y+rad*.72,z,rad*.8,color);}else{
    m.cylinder(x,y,z,rad,.15*tile,color,3,30,rad*.985);
    m.cylinder(x,y+.15*tile,z,rad*.89,.03*tile,color.map(c=>Math.min(1,c*1.21)),3,30);
    m.cylinder(x,y+.18*tile,z,rad*.69,.015*tile,color.map(c=>Math.max(0,c*.71)),3,26);
    if(value>=3)m.cylinder(x,y+.21*tile,z,rad*.36,.04*tile,[.99,.78,.28],2,20);
   }
  }
  if(anim&&progress<1){for(const i of anim.captures){if(game.board[i])continue;const val=anim.before[i];if(!val)continue;
   const col=PALETTES[room.players?.[(val-1)%2]?.color]||PALETTES.ocean,p=positions[i],s=Math.max(0,1-progress);if(chinese)m.sphere(p.x,.23+(1-s)*.5,p.z,rad*s*.78,col);else m.cylinder(p.x,.12+(1-s)*.35,p.z,rad*s,.14*tile*s,col,3,22);
  }}
  return m;
 }
 function draw(now){if(disposed||!canvas.isConnected)return;
  const width=Math.max(1,Math.round(canvas.clientWidth)),height=Math.max(1,Math.round(canvas.clientHeight));
  const pixelRatio=Math.min(2,window.devicePixelRatio||1),w=Math.round(width*pixelRatio),h=Math.round(height*pixelRatio);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);matrix=multiply(perspective(Math.PI*41/180,width/height,.12,75),view);}
  const progress=anim?Math.min(1,(now-anim.start)/690):1;
  const m=fillGeometry(progress),verts=new Float32Array(m.pts),indices=m.inds;
  // All boards stay comfortably below the 16-bit element limit.
  if(verts.length/12>65000){console.error('3D board too large');return;}
  gl.bindBuffer(gl.ARRAY_BUFFER,pBuf);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.DYNAMIC_DRAW);
  const stride=12*4;
  for(const [name,size,offset] of [['p',3,0],['n',3,12],['uv',2,24],['color',3,32],['material',1,44]]){
   gl.enableVertexAttribArray(attrs[name]);gl.vertexAttribPointer(attrs[name],size,gl.FLOAT,false,stride,offset);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,iBuf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.DYNAMIC_DRAW);
  gl.uniformMatrix4fv(uMvp,false,new Float32Array(matrix));gl.uniform3fv(uCamera,new Float32Array(camera));
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
  if(progress<1)raf=requestAnimationFrame(draw);
 }
 draw(performance.now());
 canvas.addEventListener('pointerup',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
  let nearest=-1,dist=Infinity;
  for(let i=0;i<positions.length;i++){
   const p=positions[i],v=clip(matrix,p.x,.12,p.z);if(v[3]<=0)continue;
   const cx=(v[0]/v[3]+1)/2,cy=(1-v[1]/v[3])/2;
   const d=Math.hypot((x-cx)*rect.width,(y-cy)*rect.height);
   if(d<dist){dist=d;nearest=i;}
  }
  const maxDist=Math.max(chinese?10:8,Math.min(26,rect.width/(n||15)*.72));
  if(nearest>=0&&dist<=maxDist)grid.querySelector(`[data-cell="${nearest}"]`)?.click();
 });
 const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(!disposed)draw(performance.now());}):null;
 resizeObserver?.observe(canvas);
 active={dispose(){disposed=true;cancelAnimationFrame(raf);resizeObserver?.disconnect();gl.deleteBuffer(pBuf);gl.deleteBuffer(iBuf);gl.deleteProgram(prog);try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}}};
}