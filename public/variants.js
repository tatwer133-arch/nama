// Independent, local rules engines for draughts and 2-player Chinese Checkers.
// The Egyptian Seega rules remain in game-engine.js.
export const GAME_CATALOG=[
 {id:'seega5',name:'السيجا المصرية ٥×٥',short:'سيجا ٥×٥',icon:'𓂀',sub:'الكلاسيكية • ١٢ حجر لكل لاعب'},
 {id:'seega7',name:'السيجا المصرية ٧×٧',short:'سيجا ٧×٧',icon:'🏺',sub:'التحدي الكبير • ٢٤ حجر لكل لاعب'},
 {id:'seega9',name:'السيجا المصرية ٩×٩',short:'سيجا ٩×٩',icon:'👑',sub:'الأطول • ٤٠ حجر لكل لاعب'},
 {id:'american',name:'الداما الأمريكية',short:'American Checkers',icon:'🔴',sub:'٨×٨ • أكل بالقفز وملوك'},
 {id:'russian',name:'الداما الروسية',short:'Russian Draughts',icon:'♟️',sub:'٨×٨ • أكل للخلف والملك الطائر'},
 {id:'chinese',name:'الداما الصينية',short:'Chinese Checkers',icon:'🌟',sub:'نجمة ١٢١ خانة • سباق ١٠ كرات'}
];
export const CHINESE_DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
function chinesePositions(){
 const pts=new Set(), top=[];
 const add=(q,r)=>pts.add(`${q},${r}`);
 for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++)if(Math.abs(q+r)<=4)add(q,r);
 for(let r=-8;r<=-5;r++)for(let q=-4-r;q<=4;q++)top.push([q,r]);
 function rot([q,r]){const s=-q-r;return [-s,-q];}
 let points=top.map(p=>p.slice());for(let k=0;k<6;k++){for(const p of points)add(p[0],p[1]);points=points.map(rot);}
 const list=[...pts].map(s=>s.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
 const ids=new Map(list.map((p,i)=>[p.join(','),i]));
 const bottom=top.map(p=>{let x=p;for(let i=0;i<3;i++)x=rot(x);return x;});
 return {positions:list,ids,homes:[bottom.map(p=>ids.get(p.join(','))).sort((a,b)=>a-b),top.map(p=>ids.get(p.join(','))).sort((a,b)=>a-b)]};
}
export const CHINESE=chinesePositions();
export const chineseLayout=CHINESE.positions.map(([q,r])=>({x:q+r/2,y:r*.8660254038}));
export function initialVariant(mode){
 if(mode==='chinese'){
  const board=Array(121).fill(0);for(let p=0;p<2;p++)for(const x of CHINESE.homes[p])board[x]=p+1;
  return {variant:'chinese',size:121,board,turn:0,phase:'movement',capturedBy:[0,0],winner:null,moves:0,lastMove:null,log:[]};
 }
 if(mode!=='american'&&mode!=='russian')throw Error('نوع اللعبة غير متاح');
 const board=Array(64).fill(0);
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2===1){if(r<3)board[r*8+c]=2;else if(r>4)board[r*8+c]=1;}
 return {variant:mode,size:8,board,turn:0,phase:'movement',capturedBy:[0,0],winner:null,moves:0,lastMove:null,chainIndex:null,log:[]};
}
const owner=v=>v?((v-1)%2):null;
const king=v=>v>=3;
const inside=(r,c,n=8)=>r>=0&&r<n&&c>=0&&c<n;
function diagActions(g,p,from,forceCap=false){
 const n=8,r=Math.floor(from/8),c=from%8,v=g.board[from],k=king(v),russian=g.variant==='russian';
 const actions=[];
 const dirs=[[-1,-1],[-1,1],[1,-1],[1,1]];
 for(const [dr,dc] of dirs){
  const captureAllowed=k||russian||dr===(p===0?-1:1);
  if(k&&russian){ // Flying king: slides any number of free squares, may jump one enemy with multiple landing choices.
   let rr=r+dr,cc=c+dc,enemy=-1;
   while(inside(rr,cc)){
    const i=rr*8+cc,b=g.board[i];
    if(!b){if(enemy>=0)actions.push({kind:'move',from,to:i,captures:[enemy]});else if(!forceCap)actions.push({kind:'move',from,to:i,captures:[]});}
    else if(owner(b)===p||enemy>=0)break;else enemy=i;
    rr+=dr;cc+=dc;
   }
   continue;
  }
  const rr=r+dr,cc=c+dc;
  if(!inside(rr,cc))continue;
  const near=rr*8+cc;
  if(!g.board[near]&&!forceCap&&(k||dr===(p===0?-1:1)))actions.push({kind:'move',from,to:near,captures:[]});
  if(!captureAllowed||!g.board[near]||owner(g.board[near])===p)continue;
  const r2=r+2*dr,c2=c+2*dc;if(inside(r2,c2)&&!g.board[r2*8+c2])actions.push({kind:'move',from,to:r2*8+c2,captures:[near]});
 }
 return actions;
}
function checkersLegal(g,p){
 if(g.winner!==null||p!==g.turn)return [];
 let actions=[];
 for(let i=0;i<64;i++)if(owner(g.board[i])===p&&(g.chainIndex===null||g.chainIndex===i))actions.push(...diagActions(g,p,i,g.chainIndex!==null));
 if(actions.some(a=>a.captures.length))actions=actions.filter(a=>a.captures.length);
 return actions;
}
function hopDestinations(g,from){
 const board=g.board,seen=new Set([from]),todo=[from],lands=new Set();
 while(todo.length){const curr=todo.shift(),[q,r]=CHINESE.positions[curr];
  for(const [dq,dr] of CHINESE_DIRS){
   const over=CHINESE.ids.get(`${q+dq},${r+dr}`),far=CHINESE.ids.get(`${q+2*dq},${r+2*dr}`);
   if(over===undefined||far===undefined||!board[over]||(board[far]&&far!==from)||seen.has(far))continue;
   seen.add(far);lands.add(far);todo.push(far);
  }
 }
 return [...lands];
}
function chineseLegal(g,p){
 if(g.winner!==null||g.turn!==p)return [];
 const out=[];
 for(let i=0;i<g.board.length;i++)if(g.board[i]===p+1){
  const [q,r]=CHINESE.positions[i];
  for(const [dq,dr] of CHINESE_DIRS){const to=CHINESE.ids.get(`${q+dq},${r+dr}`);if(to!==undefined&&!g.board[to])out.push({kind:'move',from:i,to,captures:[]});}
  for(const to of hopDestinations(g,i))out.push({kind:'move',from:i,to,captures:[],jump:true});
 }
 return out;
}
export function variantActions(g,p=g.turn){return g.variant==='chinese'?chineseLegal(g,p):checkersLegal(g,p);}
export function variantApply(g,p,a){
 if(!a||!Number.isInteger(a.to)||!Number.isInteger(a.from)||g.turn!==p||g.winner!==null)return {ok:false,error:'مش دورك أو حركة غير صحيحة'};
 const legal=variantActions(g,p),found=legal.find(m=>m.from===a.from&&m.to===a.to);
 if(!found)return {ok:false,error:'الحركة دي مش مسموحة'};
 const s={...g,board:[...g.board],capturedBy:[...g.capturedBy],log:[...(g.log||[])].slice(-12)};
 const piece=s.board[a.from];s.board[a.from]=0;s.board[a.to]=piece;
 for(const c of found.captures){s.board[c]=0;s.capturedBy[p]++;}
 s.moves++;s.lastMove={kind:'move',from:a.from,to:a.to,player:p,captures:found.captures,seq:s.moves};
 if(g.variant==='chinese'){
  s.turn=1-p;
  if(CHINESE.homes[1-p].every(i=>s.board[i]===p+1))s.winner=p;
 }else{
  if(g.variant==='russian'&&piece<3&&(p===0?Math.floor(a.to/8)===0:Math.floor(a.to/8)===7))s.board[a.to]=piece+2;
  if(g.variant==='american'&&piece<3&&(p===0?Math.floor(a.to/8)===0:Math.floor(a.to/8)===7))s.board[a.to]=piece+2;
  if(found.captures.length&&!(g.variant==='american'&&piece<3&&s.board[a.to]>=3)){
   s.chainIndex=a.to;
   const chain=checkersLegal(s,p);
   if(chain.length){s.log.push('أكلت حجر، كمل الأكل بنفس الحجر');return {ok:true,game:s};}
  }
  s.chainIndex=null;s.turn=1-p;
  if(!s.board.some(v=>owner(v)===1-p)||checkersLegal(s,1-p).length===0)s.winner=p;
 }
 if(s.moves>=600)s.winner='draw';
 s.log.push(`${p===0?'الأول':'الثاني'} ${found.captures.length?'أكل '+found.captures.length:'حرّك'}`);
 return {ok:true,game:s};
}
export function variantAI(g,p){
 const a=variantActions(g,p);if(!a.length)return null;
 const score=x=>{
  if(g.variant==='chinese'){
   const [q,r]=CHINESE.positions[x.from],[nq,nr]=CHINESE.positions[x.to];
   const goal=p===0?CHINESE.homes[1]:CHINESE.homes[0];
   const target=CHINESE.positions[goal[0]];
   const before=Math.abs(q-target[0])+Math.abs(r-target[1]);const after=Math.abs(nq-target[0])+Math.abs(nr-target[1]);
   return (before-after)*12+(x.jump?2:0)+Math.random()*3;
  }
  return x.captures.length*100+(g.board[x.from]>=3?3:0)+Math.random()*7;
 };
 return a.map(x=>[x,score(x)]).sort((a,b)=>b[1]-a[1])[0][0];
}