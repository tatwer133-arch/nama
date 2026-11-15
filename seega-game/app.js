const $=id=>document.getElementById(id);
const socket=io({reconnection:true,reconnectionDelay:700,reconnectionDelayMax:4000});
const params=new URLSearchParams(location.search);
let invite=(params.get('room')||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
let current=null, chosenSize=5, chosenDrops=2, chosenBot='medium', selected=null, toastTimer;
const authKey=code=>`seega:player:${code}`;
const getAuth=code=>{try{return JSON.parse(localStorage.getItem(authKey(code))||'null')}catch{return null}};
const setAuth=(code,token)=>localStorage.setItem(authKey(code),JSON.stringify({token}));
const playerName=()=>($('nameInput').value.trim()||'لاعب').slice(0,24);
function notice(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);}
function invoke(event,data,done){socket.emit(event,data,r=>{if(!r?.ok)notice(r?.error||'حصلت مشكلة');else done?.(r);});}
function setRoomUrl(code){const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState({},'',url.pathname+url.search);invite=code;}
function openLobby(){current=null;selected=null;$('gameScreen').hidden=true;$('lobby').hidden=false;}
function openGame(){ $('lobby').hidden=true;$('gameScreen').hidden=false; }
function choose(group,attr,value){for(const button of $(group).querySelectorAll('button'))button.classList.toggle('selected',button.dataset[attr]===String(value));}
$('boardChoice').addEventListener('click',e=>{const b=e.target.closest('[data-size]');if(b){chosenSize=Number(b.dataset.size);choose('boardChoice','size',chosenSize);}});
$('dropsChoice').addEventListener('click',e=>{const b=e.target.closest('[data-drops]');if(b){chosenDrops=Number(b.dataset.drops);choose('dropsChoice','drops',chosenDrops);}});
$('botChoice').addEventListener('click',e=>{const b=e.target.closest('[data-ai]');if(b){chosenBot=b.dataset.ai;choose('botChoice','ai',chosenBot);}});
$('nameInput').value=localStorage.getItem('seega:name')||'';
function rememberName(){localStorage.setItem('seega:name',playerName());}
function initInvite(){if(invite){$('joinControls').hidden=false;$('createControls').hidden=true;}else{$('joinControls').hidden=true;$('createControls').hidden=false;}}
initInvite();
$('createButton').addEventListener('click',()=>{rememberName();invoke('create_room',{name:playerName(),size:chosenSize,drops:chosenDrops},r=>{setAuth(r.code,r.token);setRoomUrl(r.code);openGame();notice('الأوضة جاهزة! ابعت اللينك لصاحبك');});});
$('botButton').addEventListener('click',()=>{rememberName();invoke('create_bot',{name:playerName(),size:chosenSize,drops:chosenDrops,difficulty:chosenBot},()=>{invite='';history.replaceState({},'',location.pathname);openGame();notice('🤖 الروبوت جاهز! يلا ورّيني شطارتك');});});
$('joinButton').addEventListener('click',()=>{rememberName();joinRoom(invite);});
$('cancelJoin').addEventListener('click',()=>{invite='';history.replaceState({},'',location.pathname);initInvite();});
function joinRoom(code){const auth=getAuth(code);invoke('join_room',{code,name:playerName(),token:auth?.token},r=>{setAuth(r.code,r.token);setRoomUrl(r.code);openGame();});}
socket.on('connect',()=>{if(invite){const auth=getAuth(invite);if(auth?.token)joinRoom(invite);}else if(current)notice('اتصلنا بالسيرفر تاني');});
socket.on('disconnect',()=>{if(current&&!current.isBot){$('statusText').textContent='الاتصال اتقطع، بنرجعه تلقائيًا...';$('turnStatus').classList.add('disconnected');}});
socket.on('transport_status',({online,channels})=>{const e=$('connectionInfo');if(!e)return;e.className='connection-info '+(online?'online':'offline');e.textContent=online?`● الاتصال الأونلاين جاهز (${channels} ${channels===1?'خدمة':'خدمات'} متصلة)`:'○ الأونلاين مش متصل دلوقتي — اللعب ضد الروبوت شغال';});
socket.on('room_state',payload=>{current=payload;openGame();render();});
function gameStatus(s){
 const g=s.game,ready=Boolean(s.players[1]);
 if(!ready)return 'مستنيين صاحبك يدخل من لينك الدعوة';
 if(!s.isBot && s.you===1 && !s.players[0]?.online)return 'صاحب الأوضة مش متصل دلوقتي. خليه يفتح اللعبة تاني';
 if(g.phase==='done')return g.winner==='draw'?'الماتش انتهى تعادل':g.winner===s.you?'🎉 مبروك! أنت كسبت':'الماتش خلص، حظ أوفر المرة الجاية';
 const mine=g.turn===s.you;
 if(g.phase==='placement'){
   const remaining=g.drops-g.dropped;
   return mine?`دورك! حط ${remaining===1?'حجر':'حجرين'} في المربعات الفاضية`:`استنى، ${s.players[g.turn]?.name||'الخصم'} بيوزّع الحجارة`;
 }
 if(g.forcedFrom!==null)return mine?'أكلة كمان! كمّل بنفس الحجر أو انهي دورك':'الخصم عنده فرصة يكمل أكل';
 return mine?'دورك! اختار حجرك وحرّكه':s.isBot?'🤖 الكمبيوتر بيفكر في نقلته...':'استنى دور صاحبك...';
}
const idxRow=(idx,size)=>Math.floor(idx/size),idxCol=(idx,size)=>idx%size;
function steps(g,from){if(g.board[from]!==current.you)return [];const size=g.size,r=idxRow(from,size),c=idxCol(from,size);return [[-1,0],[1,0],[0,-1],[0,1]].flatMap(([dr,dc])=>{const y=r+dr,x=c+dc;if(y<0||y>=size||x<0||x>=size)return [];const to=y*size+x;return g.board[to]===null?[to]:[];});}
function canEatAfter(g,from,to){const board=g.board.slice(),size=g.size,p=current.you;board[from]=null;board[to]=p;const r=idxRow(to,size),c=idxCol(to,size);return [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc])=>{const ar=r+dr,ac=c+dc,br=r+2*dr,bc=c+2*dc;if(br<0||br>=size||bc<0||bc>=size)return false;const a=ar*size+ac,b=br*size+bc;return a!==Math.floor(board.length/2)&&board[a]===1-p&&board[b]===p;});}
function allowedTargets(g,from){const legal=steps(g,from);return g.forcedFrom!==null?legal.filter(to=>canEatAfter(g,from,to)):legal;}
function renderBoard(){const g=current.game,b=$('board');b.style.setProperty('--size',g.size);b.replaceChildren();
 if(g.forcedFrom!==null&&g.turn===current.you)selected=g.forcedFrom;
 if(selected!==null&&g.board[selected]!==current.you)selected=null;
 const targets=selected!==null&&g.phase==='movement'?allowedTargets(g,selected):[];
 g.board.forEach((stone,i)=>{
   const button=document.createElement('button');button.type='button';button.className='cell';button.setAttribute('role','gridcell');button.setAttribute('aria-label',`صف ${idxRow(i,g.size)+1} عمود ${idxCol(i,g.size)+1}${stone===null?' فاضي':stone===0?' حجر فيروزي':' حجر نحاسي'}`);
   if(i===Math.floor(g.board.length/2))button.classList.add('center-cell');
   if(i===selected)button.classList.add('selected-cell');
   if(targets.includes(i))button.classList.add('valid-target');
   if(g.last?.to===i||g.last?.at===i)button.classList.add('last-move');
   if(stone!==null){const el=document.createElement('span');el.className=`stone p${stone}`;el.setAttribute('aria-hidden','true');button.appendChild(el);}
   button.addEventListener('click',()=>tapCell(i));b.appendChild(button);
 });
}
function tapCell(i){if(!current)return;const g=current.game;
 if(!current.players[1])return notice('استنى صاحبك يدخل الأوضة');
 if(g.phase==='done')return;
 if(g.turn!==current.you)return notice('استنى دورك يا نجم');
 if(g.phase==='placement')return invoke('play',{type:'place',at:i},()=>{selected=null;});
 if(g.board[i]===current.you){if(g.forcedFrom!==null&&i!==g.forcedFrom)return notice('لازم تكمل بنفس الحجر');selected=i;renderBoard();return;}
 if(selected!==null&&g.board[i]===null){if(!allowedTargets(g,selected).includes(i))return notice('اختار مربع أخضر ملاصق لحجرك');invoke('play',{type:'move',from:selected,to:i},()=>{selected=null;});return;}
 notice('اختار حجر من لونك الأول');
}
function render(){const s=current,g=s.game;const mine=g.turn===s.you;
 $('roomCode').textContent=s.code;
 $('roomStrip').hidden=Boolean(s.isBot);$('shareBottomButton').hidden=Boolean(s.isBot);
 $('matchMode').textContent=s.isBot?'🤖 تحدّي الكمبيوتر':'🌐 ماتش أونلاين';
 [0,1].forEach(i=>{const p=s.players[i];$('playerName'+i).textContent=p?.name||(i===1?'مستنيين صاحبك...':'اللاعب');$('playerOnline'+i).textContent=p?.online?'● متصل':'○ غير متصل';$('left'+i).textContent=g.phase==='placement'?(g.size*g.size-1)/2-g.placed[i]:g.board.filter(v=>v===i).length;$('player'+i).classList.toggle('active',g.phase!=='done'&&g.turn===i);$('player'+i).classList.toggle('mine',s.you===i);});
 $('phaseLabel').textContent=g.phase==='placement'?'مرحلة التوزيع':g.phase==='movement'?'مرحلة التحريك':'انتهى الماتش';
 $('statusText').textContent=gameStatus(s);
 $('turnStatus').style.background=mine&&s.players[1]&&g.phase!=='done'?'#d9be8a':'#aabeb5';
 $('moveHelp').textContent=g.phase==='placement'?'اختار خانة فاضية (ما عدا النص)':g.phase==='movement'?'اضغط على حجرك، وبعدها على المربع الأخضر':'خلص الماتش، استعد للجولة الجديدة';
 $('endChainButton').hidden=!(g.phase==='movement'&&mine&&g.forcedFrom!==null);
 $('endGame').hidden=g.phase!=='done';
 if(g.phase==='done'){
   $('winnerArt').textContent=g.winner===s.you?'🏆':g.winner==='draw'?'🤝':'🎯';
   $('resultTitle').textContent=g.winner==='draw'?'تعادل يا رجالة':g.winner===s.you?'مبروك عليك يا بطل!':'صاحبك كسب المرة دي';
   $('resultDescription').textContent=g.winner==='draw'?'ولا واحد فيكم قدر يغلب التاني':'العبوا تاني وشوفوا مين هيكسب الجولة الجديدة';
   $('rematchButton').disabled=!s.isBot&&Boolean(s.rematch[s.you]);
   $('rematchButton').textContent=s.isBot?'🤖 العب جولة جديدة ↻':s.rematch[s.you]?'مستنيين موافقة صاحبك...':'دور جديد ↻';
   $('rematchStatus').textContent=s.isBot?'':s.rematch[1-s.you]?'صاحبك طلب إعادة الماتش':'';
 }
 renderBoard();
}
$('endChainButton').addEventListener('click',()=>invoke('play',{type:'endChain'},()=>{selected=null;}));
$('rematchButton').addEventListener('click',()=>invoke('rematch',{},()=>{selected=null;}));
$('exitButton').addEventListener('click',()=>{window.location.assign(location.pathname);});
async function share(){if(!current||current.isBot){notice('اعمل أوضة أونلاين الأول');return;}const u=new URL(location.href);u.searchParams.set('room',current.code);const url=u.toString();
 try {if(navigator.share){await navigator.share({title:'تعالى نلعب سيجا فلاحي',text:'يلا نلعب السيجا الفلاحي سوا!',url});return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);notice('نسخنا اللينك! ابعته لصاحبك');return;}}
 catch(e){if(e?.name==='AbortError')return;}
 window.prompt('انسخ لينك الدعوة وابعتُه لصاحبك:',url);
}
$('shareButton').addEventListener('click',share);$('shareBottomButton').addEventListener('click',share);
function showRules(show){$('rulesModal').hidden=!show;document.body.style.overflow=show?'hidden':'';}
for(const id of ['rulesButton','rulesBottomButton'])$(id).addEventListener('click',()=>showRules(true));
for(const id of ['closeRules','gotRules'])$(id).addEventListener('click',()=>showRules(false));
$('rulesModal').addEventListener('click',e=>{if(e.target===$('rulesModal'))showRules(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')showRules(false);});
if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('./sw.js',location.href)).catch(()=>{});
