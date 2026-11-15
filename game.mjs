// Server-authoritative, deterministic rules for traditional Egyptian Seega.
export const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const index = (size, row, col) => row * size + col;
const inside = (size, row, col) => row >= 0 && col >= 0 && row < size && col < size;
const pos = (size, i) => [Math.floor(i / size), i % size];
const validIndex = (g, i) => Number.isInteger(i) && i >= 0 && i < g.board.length;

export function newGame(size = 5, drops = 2, first = 0) {
  assert([5, 7].includes(size), 'حجم اللوحة غير مدعوم');
  assert([1, 2].includes(drops), 'عدد الحجارة في الدور غير صحيح');
  assert([0, 1].includes(first), 'اللاعب الأول غير صحيح');
  return {
    size, drops, first, board: Array(size * size).fill(null),
    phase: 'placement', turn: first, placed: [0, 0], dropped: 0,
    captured: [0, 0], moveCount: 0, noCaptureMoves: 0, forcedFrom: null,
    winner: null, last: null, message: 'ابدأوا بتوزيع الحجارة'
  };
}

export function center(g) { return Math.floor(g.board.length / 2); }
export function piecesLeft(g, player) { return g.board.filter(x => x === player).length; }
export function legalSteps(g, from, player) {
  if (!validIndex(g, from) || g.board[from] !== player) return [];
  const [r,c] = pos(g.size, from);
  return DIRS.flatMap(([dr,dc]) => {
    const rr=r+dr, cc=c+dc;
    return inside(g.size, rr, cc) && g.board[index(g.size, rr, cc)] === null
      ? [index(g.size, rr, cc)] : [];
  });
}
export function canMove(g, player) {
  return g.board.some((value, i) => value === player && legalSteps(g, i, player).length);
}

// Only the newly moved stone causes captures; the central square is immune.
export function capturedFrom(g, to, player) {
  const [r,c] = pos(g.size, to), enemy=1-player;
  return DIRS.flatMap(([dr,dc]) => {
    const ar=r+dr, ac=c+dc, br=r+2*dr, bc=c+2*dc;
    if (!inside(g.size, br, bc)) return [];
    const a=index(g.size, ar, ac), b=index(g.size, br, bc);
    return a!==center(g) && g.board[a]===enemy && g.board[b]===player ? [a] : [];
  });
}
function possibleExtraCapture(g, from, player) {
  return legalSteps(g, from, player).some(to => {
    const copy = { ...g, board: g.board.slice() };
    copy.board[to]=player; copy.board[from]=null;
    return capturedFrom(copy, to, player).length > 0;
  });
}
function decideStalemate(g) {
  const left=[piecesLeft(g,0),piecesLeft(g,1)];
  g.winner=left[0]===left[1] ? 'draw' : left[0]>left[1] ? 0 : 1;
  g.phase='done'; g.forcedFrom=null;
  g.message = g.winner==='draw' ? 'تعادل!' : 'انتهت المباراة';
}
function passTurn(g, player) {
  g.forcedFrom=null;
  const next=1-player;
  if (canMove(g,next)) { g.turn=next; return; }
  if (canMove(g,player)) {
    g.turn=player;
    g.message='الخصم محبوس، ليك دور إضافي';
    return;
  }
  decideStalemate(g);
}
export function apply(g, player, action) {
  assert(g && Array.isArray(g.board), 'حالة اللعبة غير صالحة');
  assert(g.phase !== 'done', 'الماتش خلص');
  assert(player===0 || player===1, 'لاعب غير صحيح');
  assert(g.turn===player, 'استنى دورك');
  assert(action && typeof action==='object', 'حركة غير صحيحة');
  const next={...g, board:g.board.slice(), placed:[...g.placed], captured:[...g.captured]};
  const total=(g.size*g.size-1)/2;

  if (next.phase==='placement') {
    assert(action.type==='place', 'دلوقتي دور توزيع الحجارة');
    assert(validIndex(next,action.at) && action.at!==center(next), 'الخانة دي مش متاحة');
    assert(next.board[action.at]===null, 'الخانة مش فاضية');
    assert(next.placed[player]<total, 'حجارتك خلصت');
    next.board[action.at]=player;
    next.placed[player]++;
    next.dropped++;
    next.last={type:'place',at:action.at,player};
    if (next.placed[0]===total && next.placed[1]===total) {
      next.phase='movement'; next.turn=1-next.first;
      next.dropped=0; next.message='خلص التوزيع، ابدأوا التحريك والأكل';
      if (!canMove(next,next.turn)) {
        if (canMove(next,1-next.turn)) {
          next.turn=1-next.turn;
          next.message='اللاعب التاني محبوس، الدور على خصمه لفتح حركة';
        } else decideStalemate(next);
      }
    } else if (next.dropped>=next.drops || next.placed[player]>=total) {
      next.dropped=0; next.turn=1-player;
      next.message='الدور على اللاعب التاني';
    } else {
      next.message='حط الحجر اللي بعده';
    }
    return next;
  }

  if (action.type==='endChain') {
    assert(next.forcedFrom!==null, 'مفيش أكلة إضافية لإنهائها');
    next.last={type:'endChain',player};
    next.message='انتهى الدور';
    passTurn(next,player);
    return next;
  }

  assert(action.type==='move', 'اختار حجر وانقله لخانة جنبه');
  assert(validIndex(next,action.from) && validIndex(next,action.to), 'خانة غير صحيحة');
  assert(next.board[action.from]===player, 'ده مش حجرك');
  assert(next.forcedFrom===null || next.forcedFrom===action.from, 'كمّل بنفس الحجر أو انهي الدور');
  assert(legalSteps(next, action.from, player).includes(action.to), 'تتحرك خطوة واحدة أفقي أو رأسي فقط');
  const before = next.forcedFrom;
  next.board[action.from]=null; next.board[action.to]=player;
  const removed=capturedFrom(next,action.to,player);
  if(before!==null) assert(removed.length>0,'لازم الحركة الإضافية تكون فيها أكل');
  for (const i of removed) next.board[i]=null;
  next.captured[player]+=removed.length;
  next.moveCount++;
  next.noCaptureMoves=removed.length ? 0 : next.noCaptureMoves+1;
  next.last={type:'move',from:action.from,to:action.to,player,removed};
  if (removed.length && piecesLeft(next,1-player)===0) {
    next.winner=player;next.phase='done';next.forcedFrom=null;
    next.message='مبروك! كسبت الماتش';
    return next;
  }
  if (next.noCaptureMoves>=100) {
    decideStalemate(next); return next;
  }
  if (removed.length && possibleExtraCapture(next,action.to,player)) {
    next.forcedFrom=action.to;
    next.message=`أكلت ${removed.length}! تقدر تكمل بنفس الحجر أو تنهي الدور`;
  } else {
    next.message=removed.length ? `أكلت ${removed.length} حجر` : 'الدور على اللاعب التاني';
    passTurn(next,player);
  }
  return next;
}
