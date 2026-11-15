import {apply,legalSteps,capturedFrom,center} from './game.mjs';

const rand = n => Math.floor(Math.random()*n);
const pos=(i,n)=>[Math.floor(i/n),i%n];
const near=(a,b,n)=>{const [ar,ac]=pos(a,n),[br,bc]=pos(b,n);return Math.abs(ar-br)+Math.abs(ac-bc)};
export function movesFor(g,player){
 if(g.phase==='done'||g.turn!==player)return [];
 if(g.phase==='placement')return g.board.flatMap((x,i)=>x===null&&i!==center(g)?[{type:'place',at:i}]:[]);
 const moves=[];
 for(let i=0;i<g.board.length;i++){
   if(g.board[i]!==player||(g.forcedFrom!==null&&g.forcedFrom!==i))continue;
   for(const to of legalSteps(g,i,player)){
     if(g.forcedFrom!==null){const copy={...g,board:g.board.slice()};copy.board[i]=null;copy.board[to]=player;
       if(!capturedFrom(copy,to,player).length)continue;
     }
     moves.push({type:'move',from:i,to});
   }
 }
 if(g.forcedFrom!==null)moves.push({type:'endChain'});
 return moves;
}
function mobility(g,p){let sum=0;for(let i=0;i<g.board.length;i++)if(g.board[i]===p)sum+=legalSteps(g,i,p).length;return sum;}
function threats(g,p){
 let count=0;
 for(let i=0;i<g.board.length;i++)if(g.board[i]===p){
  for(const to of legalSteps(g,i,p)){
   const copy={...g,board:g.board.slice()};copy.board[i]=null;copy.board[to]=p;
   count+=capturedFrom(copy,to,p).length;
  }
 }
 return count;
}
function evaluate(g,p){
 const mine=g.board.filter(v=>v===p).length,enemy=g.board.filter(v=>v===1-p).length;
 if(g.phase==='done')return g.winner===p?1e5:g.winner===1-p?-1e5:0;
 let score=(mine-enemy)*90 + (mobility(g,p)-mobility(g,1-p))*2;
 if(g.phase==='movement')score+=(threats(g,p)-threats(g,1-p))*13;
 return score;
}
function placementScore(g,action,p){
 const n=g.size,i=action.at,c=Math.floor(n*n/2),d=near(i,c,n);
 let ownNear=0,opNear=0;
 g.board.forEach((v,j)=>{if(v!==null&&near(i,j,n)===1){if(v===p)ownNear++;else opNear++;}});
 return ownNear*2.3 + opNear*.8 + (n-d)*.14 + (Math.random()-.5)*2;
}
/** Choose one strictly legal action; level easy, medium or hard. No external APIs. */
export function chooseBotMove(g,player=1,level='medium'){
 const legal=movesFor(g,player);if(!legal.length)return null;
 if(level==='easy')return legal[rand(legal.length)];
 let best=-Infinity,pick=legal[0];
 for(const action of legal){
  let score=0;
  if(g.phase==='placement')score=placementScore(g,action,player);
  else{
   try {
    const after=apply(g,player,action);
    score=evaluate(after,player)-evaluate(g,player);
    const eat=(after.captured?.[player]||0)-(g.captured?.[player]||0);
    score+=eat*(level==='hard'?200:115);
    if(action.type==='endChain')score-=5;
    if(level==='hard'&&after.phase==='movement'&&after.turn===1-player&&after.phase!=='done'){
      // Inspect the opponent's strongest immediate capture, avoiding obvious traps.
      const replies=movesFor(after,1-player);
      let worst=0;
      for(const response of replies){
       if(response.type!=='move')continue;
       try {const q=apply(after,1-player,response),taken=q.captured[1-player]-after.captured[1-player];worst=Math.max(worst,taken);}catch(_){/* skip illegal */}
      }
      score-=worst*175;
    }
   } catch(_){continue;}
  }
  const randomness=level==='hard'?Math.random()*1.5:Math.random()*26;
  score+=randomness;
  if(score>best){best=score;pick=action;}
 }
 return pick;
}
