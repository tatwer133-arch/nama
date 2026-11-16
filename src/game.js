export const BOARD_SIZE = 5;
export const CENTER = 12;
const directions = [[-1,0],[1,0],[0,-1],[0,1]];
const at = (r,c) => (r >= 0 && r < 5 && c >= 0 && c < 5) ? r*5+c : -1;
const point = i => [Math.floor(i/5),i%5];
export const other = p => p===0?1:0;
export const count = (s,p) => s.board.filter(x => x===p+1).length;
export const validIndex = i => Number.isInteger(i) && i>=0 && i<25;
export function initialGame(){return {board:Array(25).fill(0),phase:'placement',turn:0,placed:[0,0],stepInTurn:0,chainIndex:null,winner:null,moves:0,stale:0,lastMove:null,log:[]};}
export function neighbors(i){const [r,c]=point(i);return directions.map(([dr,dc])=>at(r+dr,c+dc)).filter(x=>x>=0);}
export function captureTargets(board,to,p){
  const [r,c]=point(to); const opp=other(p)+1, mine=p+1;
  const targets=[];
  for(const [dr,dc] of directions){const middle=at(r+dr,c+dc),outer=at(r+dr*2,c+dc*2);
    if(middle>=0 && middle!==CENTER && outer>=0 && board[middle]===opp && board[outer]===mine)targets.push(middle);
  }
  return targets;
}
export function legalActions(s,p=s.turn){
  if(s.winner!==null || p!==s.turn)return [];
  if(s.phase==='placement')return s.board.flatMap((v,i)=>v===0 && i!==CENTER?[{kind:'place',to:i}]:[]);
  const actions=[];
  for(let i=0;i<25;i++){if(s.board[i]!==p+1 || (s.chainIndex!==null && s.chainIndex!==i))continue;
    for(const j of neighbors(i)){if(s.board[j]!==0)continue;
      const copy=s.board.slice();copy[i]=0;copy[j]=p+1;
      const caps=captureTargets(copy,j,p);
      if(s.chainIndex===null || caps.length)actions.push({kind:'move',from:i,to:j,captures:caps});
    }
  }
  return actions;
}
export function hasMoves(s,p){return s.board.some((v,i)=>v===p+1 && neighbors(i).some(j=>s.board[j]===0));}
const copyGame = s => ({...s,board:s.board.slice(),placed:s.placed.slice(),log:[...s.log].slice(-18)});
function finishIfStale(s){if(s.stale>=80 || s.moves>=500){const a=count(s,0),b=count(s,1);s.winner=a===b?'draw':a>b?0:1;} }
export function applyAction(state,player,action){
  if(!state || state.winner!==null || player!==state.turn)return {ok:false,error:'مش دورك دلوقتي'};
  if(!action || !validIndex(action.to))return {ok:false,error:'حركة غير صحيحة'};
  const possible=legalActions(state,player);
  const found=possible.find(a=>a.kind===action.kind && a.to===action.to && (a.kind==='place'||a.from===action.from));
  if(!found)return {ok:false,error:'الحركة دي مش مسموحة'};
  const s=copyGame(state);
  if(found.kind==='place'){
    s.board[found.to]=player+1;s.placed[player]++;s.stepInTurn++;
    s.lastMove={kind:'place',player,to:found.to,captures:[]};
    if(s.placed[0]===12 && s.placed[1]===12){s.phase='movement';s.stepInTurn=0;s.turn=player;}
    else if(s.stepInTurn===2){s.stepInTurn=0;s.turn=other(player);}
  }else{
    s.board[found.from]=0;s.board[found.to]=player+1;
    const captured=found.captures;
    for(const idx of captured)s.board[idx]=0;
    s.moves++;s.stale=captured.length?0:s.stale+1;
    s.lastMove={kind:'move',player,from:found.from,to:found.to,captures:captured};
    if(count(s,other(player))===0){s.winner=player;}
    else if(captured.length){
      s.chainIndex=found.to;
      if(legalActions(s,player).some(a=>a.captures?.length)){
        s.log=[...s.log,`اللاعب ${player+1} أكل ${captured.length} حجر وله حركة إضافية`].slice(-18);
        return {ok:true,game:s};
      }
      s.chainIndex=null;s.turn=other(player);
    } else {s.chainIndex=null;s.turn=other(player);}
    if(s.winner===null){
      finishIfStale(s);
      if(s.winner===null && !hasMoves(s,s.turn)){
        if(hasMoves(s,other(s.turn))) {s.log=[...s.log,'اللاعب المحبوس فوّت دوره'].slice(-18);s.turn=other(s.turn);}
        else {const a=count(s,0),b=count(s,1);s.winner=a===b?'draw':a>b?0:1;}
      }
    }
  }
  s.log=[...s.log,`${player===0?'الأول':'الثاني'}: ${found.kind==='place'?'حط حجر':'حرّك حجر'}${found.captures?.length?' وأكل '+found.captures.length:''}`].slice(-18);
  return {ok:true,game:s};
}
export function aiAction(s,p){
  const moves=legalActions(s,p);if(!moves.length)return null;
  const score=a=>{
    if(a.kind==='place'){
      const [r,c]=point(a.to); let points=3-Math.abs(r-2)+3-Math.abs(c-2);
      for(const n of neighbors(a.to)){if(s.board[n]===p+1)points+=0.6;else if(s.board[n]===other(p)+1)points+=0.25;}
      return points+Math.random()*3;
    }
    let points=a.captures.length*100;
    const board=s.board.slice();board[a.from]=0;board[a.to]=p+1;
    const [r,c]=point(a.to);points+=4-Math.abs(r-2)-Math.abs(c-2);
    for(const [dr,dc] of directions){const enemy=at(r+dr,c+dc),otherSide=at(r-dr,c-dc);
      if(enemy>=0 && otherSide>=0 && board[enemy]===other(p)+1 && board[otherSide]===0)points-=2;
    }
    return points+Math.random()*1.5;
  };
  return moves.sort((a,b)=>score(b)-score(a))[0];
}