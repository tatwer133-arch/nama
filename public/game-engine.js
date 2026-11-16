// Traditional Egyptian Seega. Two placements per turn; 5×5 or 7×7.
export const BOARD_SIZE=5;
export const CENTER=12;
export const sizes=[5,7];
export const centerOf=size=>(size*size-1)/2;
export const other=p=>p===0?1:0;
export const count=(s,p)=>s.board.filter(x=>x===p+1).length;
const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
const at=(r,c,n)=>(r>=0&&r<n&&c>=0&&c<n)?r*n+c:-1;
const pos=(i,n)=>[Math.floor(i/n),i%n];
export const validIndex=(i,size=5)=>Number.isInteger(i)&&i>=0&&i<size*size;
export function initialGame(size=5){
 if(!sizes.includes(Number(size)))throw Error('Board size must be 5 or 7');
 return {size:Number(size),board:Array(size*size).fill(0),phase:'placement',turn:0,
  placed:[0,0],capturedBy:[0,0],stepInTurn:0,chainIndex:null,winner:null,
  moves:0,stale:0,lastMove:null,log:[]};
}
export function neighbors(i,n=5){const [r,c]=pos(i,n);return dirs.map(([dr,dc])=>at(r+dr,c+dc,n)).filter(x=>x>=0);}
export function captureTargets(board,to,p,size=Math.sqrt(board.length)){
 const [r,c]=pos(to,size),opp=other(p)+1,mine=p+1,out=[];
 for(const [dr,dc] of dirs){const mid=at(r+dr,c+dc,size),end=at(r+2*dr,c+2*dc,size);
  if(mid>=0&&mid!==centerOf(size)&&end>=0&&board[mid]===opp&&board[end]===mine)out.push(mid);
 }return out;
}
export function legalActions(s,p=s.turn){
 const n=s.size||5;if(s.winner!==null||s.turn!==p)return [];
 if(s.phase==='placement')return s.board.flatMap((v,i)=>v===0&&i!==centerOf(n)?[{kind:'place',to:i}]:[]);
 const out=[];
 for(let i=0;i<s.board.length;i++){
  if(s.board[i]!==p+1||(s.chainIndex!==null&&s.chainIndex!==i))continue;
  for(const j of neighbors(i,n)){
   if(s.board[j]!==0)continue;
   const next=s.board.slice();next[i]=0;next[j]=p+1;
   const captures=captureTargets(next,j,p,n);
   if(s.chainIndex===null||captures.length)out.push({kind:'move',from:i,to:j,captures});
  }
 }return out;
}
export function hasMoves(s,p){return s.board.some((v,i)=>v===p+1&&neighbors(i,s.size||5).some(j=>s.board[j]===0));}
function finishStale(s){if(s.stale>=80||s.moves>=700){const a=count(s,0),b=count(s,1);s.winner=a===b?'draw':a>b?0:1;}}
export function applyAction(state,player,action){
 if(!state||state.winner!==null||state.turn!==player)return {ok:false,error:'مش دورك دلوقتي'};
 if(!action||!validIndex(action.to,state.size||5))return {ok:false,error:'حركة غير صحيحة'};
 const possible=legalActions(state,player),found=possible.find(a=>a.kind===action.kind&&a.to===action.to&&(a.kind==='place'||a.from===action.from));
 if(!found)return {ok:false,error:'الحركة دي مش مسموحة'};
 const s={...state,board:state.board.slice(),placed:state.placed.slice(),capturedBy:[...(state.capturedBy||[0,0])],log:[...state.log].slice(-18)};
 if(found.kind==='place'){
  s.board[found.to]=player+1;s.placed[player]++;s.stepInTurn++;
  s.lastMove={kind:'place',player,to:found.to,captures:[],seq:s.placed[0]+s.placed[1]};
  const target=((s.size||5)**2-1)/2;
  if(s.placed[0]===target&&s.placed[1]===target){s.phase='movement';s.stepInTurn=0;s.turn=player;}
  else if(s.stepInTurn===2){s.stepInTurn=0;s.turn=other(player);}
 }else{
  s.board[found.from]=0;s.board[found.to]=player+1;
  for(const i of found.captures)s.board[i]=0;
  s.moves++;s.stale=found.captures.length?0:s.stale+1;s.capturedBy[player]+=found.captures.length;
  s.lastMove={kind:'move',player,from:found.from,to:found.to,captures:[...found.captures],seq:s.moves};
  if(count(s,other(player))===0)s.winner=player;
  else if(found.captures.length){
   s.chainIndex=found.to;
   if(legalActions(s,player).some(a=>a.captures?.length)){
    s.log=[...s.log,`اللاعب ${player+1} أكل ${found.captures.length} وله حركة إضافية`].slice(-18);
    return {ok:true,game:s};
   }
   s.chainIndex=null;s.turn=other(player);
  }else{s.chainIndex=null;s.turn=other(player);}
  if(s.winner===null){finishStale(s);if(s.winner===null&&!hasMoves(s,s.turn)){
   if(hasMoves(s,other(s.turn))){s.log.push('اللاعب المحبوس فوّت دوره');s.turn=other(s.turn);}
   else {const a=count(s,0),b=count(s,1);s.winner=a===b?'draw':a>b?0:1;}
  }}
 }
 s.log.push(`${player===0?'الأول':'الثاني'}: ${found.kind==='place'?'حط حجر':'حرّك حجر'}${found.captures?.length?' وأكل '+found.captures.length:''}`);
 s.log=s.log.slice(-18);return {ok:true,game:s};
}
export function aiAction(s,p){
 const moves=legalActions(s,p);if(!moves.length)return null;
 const n=s.size||5,mid=(n-1)/2;
 const score=a=>{
  if(a.kind==='place'){
   const [r,c]=pos(a.to,n);let points=n-Math.abs(r-mid)-Math.abs(c-mid);
   for(const k of neighbors(a.to,n))points+=s.board[k]===p+1?.5:s.board[k]===other(p)+1?.25:0;
   return points+Math.random()*3;
  }
  let pts=a.captures.length*100;
  const board=s.board.slice();board[a.from]=0;board[a.to]=p+1;
  const [r,c]=pos(a.to,n);pts+=n-Math.abs(r-mid)-Math.abs(c-mid);
  for(const [dr,dc] of dirs){const e=at(r+dr,c+dc,n),o=at(r-dr,c-dc,n);
   if(e>=0&&o>=0&&board[e]===other(p)+1&&board[o]===0)pts-=2;
  }return pts+Math.random()*1.5;
 };
 return moves.map(a=>({a,v:score(a)})).sort((a,b)=>b.v-a.v)[0].a;
}