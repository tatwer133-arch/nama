const $=sel=>document.querySelector(sel);
const fmt=n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(n??0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={me:null,tab:'home',room:null,rooms:[],store:[],config:null,friends:[],ranking:[],search:[],world:[],socket:null,selected:null,authView:'login',socialMode:'friends',dmId:null,dmMessages:[],voice:false,localStream:null,peer:null,iceQueue:[],busy:false};
let toastTimer=null;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3100);}
async function api(path,options={}){const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...options});let data;try{data=await r.json();}catch{data={};}if(!r.ok)throw Error(data.error||'حصلت مشكلة في الاتصال');return data;}
const post=(path,data={})=>api(path,{method:'POST',body:JSON.stringify(data)});
const patch=(path,data={})=>api(path,{method:'PATCH',body:JSON.stringify(data)});
function wallet(){if(!state.me)return;$('#coin-count').textContent=fmt(state.me.coins);$('#gem-count').textContent=fmt(state.me.gems);}
function playerName(){return state.me?.name||'يا بطل';}
function avatar(user,cls=''){return `<span class="avatar-icon ${cls}">${esc(user?.avatar||'🎮')}</span>`;}
function sound(){if(state.me?.settings?.sound===false)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=570;gain.gain.value=.04;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.07);setTimeout(()=>ctx.close(),180);}catch{}}
function setMe(u){state.me=u;wallet();}
function view(tab){state.tab=tab;state.room=null;state.selected=null;$('#topbar').classList.remove('hidden');$('#nav').classList.remove('hidden');document.querySelectorAll('[data-tab]').forEach(b=>{if(b.classList.contains('nav-item'))b.classList.toggle('active',b.dataset.tab===tab);});render();window.scrollTo(0,0);}
function btn(text,action,cls='btn-primary'){return `<button class="btn ${cls}" data-action="${action}">${text}</button>`;}
function cap(k){return {private:'خاصة',public:'عامة',vip:'ملكية VIP',quick:'تحدّي سريع',bot:'ضد الكمبيوتر'}[k]||k;}
function renderHome(){const u=state.me;return `<section class="welcome"><div><div class="eyebrow">أهلًا بيك في اللمة</div><h2>منورنا يا ${esc(u.name)} 👋</h2><p>جاهز تكسب الجولة الجاية؟</p></div>${avatar(u)}</section>
 <section class="hero"><div class="spark">✨</div><span class="little-tag">🏆 لعبة السيجا المصرية</span><h1>حُط الحجر<br>واكسب <em>التحدّي!</em></h1><p>العب مع صحابك من أي مكان، أو جرّب مستواك ضد رمسيس.</p>${btn('⚔️ لعب سريع','quick')}</section>
 <section class="reward-banner"><span class="reward-icon">🎁</span><div><strong>هديتك اليومية مستنياك</strong><p>٤٥٠ كوين + ١٠ جواهر كل يوم</p></div>${btn('استلم','daily','btn-mint')}</section>
 <div class="section-head"><h3>اختار طريقة اللعب</h3><span>كل الطرق مجانية*</span></div><div class="mode-grid">
 <button data-action="bot" class="mode-card teal"><span class="mode-icon">🤖</span><strong>العب مع رمسيس</strong><small>الكمبيوتر مستنيك</small></button>
 <button data-action="quick" class="mode-card red"><span class="mode-icon">⚡</span><strong>تحدي سريع</strong><small>لاعب حقيقي أونلاين</small></button>
 <button data-action="private" class="mode-card blue"><span class="mode-icon">👥</span><strong>غرفة صحاب</strong><small>ابعت الكود للي تحبه</small></button>
 <button data-action="vip" class="mode-card gold"><span class="mode-icon">👑</span><strong>غرفة ملكية</strong><small>تحدي بـ ٢٥٠ كوين افتراضي</small></button>
 </div><div class="section-head"><h3>أرقامك يا بطل</h3><button class="mini-link" data-action="ranking">🏆 الترتيب</button></div>
 <div class="stat-row"><div class="stat"><b>${fmt(u.wins)}</b><small>مكسب</small></div><div class="stat"><b>${fmt(u.xp)}</b><small>نقطة خبرة</small></div><div class="stat"><b>${fmt(Math.floor(u.xp/500)+1)}</b><small>المستوى</small></div></div>
 <p class="footnote">*الكوينز والجواهر عملات داخل اللعبة فقط، وليست فلوس حقيقية.</p>`;}
function renderRooms(){return `<h1 class="page-title">🎲 صالة اللعب</h1><p class="page-sub">اختار غرفة موجودة أو اعمل واحدة جديدة وشارك الكود مع أصحابك.</p>
 <div class="join-box"><input id="join-code" class="input" placeholder="كود الغرفة — مثل ABC123" maxlength="6" autocomplete="off" aria-label="كود الغرفة">${btn('ادخل الغرفة','join-code')}</div>
 <div class="mode-grid" style="margin-bottom:15px"><button class="mode-card teal" data-action="public"><span class="mode-icon">🎲</span><strong>غرفة عامة</strong><small>حد يقدر يدخل يلعب</small></button><button class="mode-card gold" data-action="vip"><span class="mode-icon">👑</span><strong>غرفة VIP</strong><small>دخول ٢٥٠ كوين افتراضي</small></button></div>
 <div class="section-head"><h3>الغرف المفتوحة</h3><button class="mini-link" data-action="refresh-rooms">تحديث ↻</button></div>
 <div class="room-list">${state.rooms.length?state.rooms.map(r=>`<div class="list-row">${avatar(r.owner)}<div class="row-main"><strong>${esc(r.owner?.name||'لاعب')}</strong><small>كود: ${esc(r.id)} · ${cap(r.kind)}</small></div><button class="btn btn-primary" data-action="join" data-id="${r.id}">انضم</button></div>`).join(''):`<div class="empty-state"><span class="big">🎲</span>لسه مفيش غرف عامة مستنية لاعبين<br>اعمل غرفة وخلي غيرك ينضم!</div>`}</div>
 <div class="section-head"><h3>خُد صاحبك لوحدكم</h3></div>${btn('🔒 اعمل غرفة بكود خاص','private','btn-secondary full')}`;}
function renderStore(){const u=state.me;return `<h1 class="page-title">🛍️ السوق الملكي</h1><p class="page-sub">زيّن حجارتك واختار طقم يميزك في كل جولة.</p>
 <div class="reward-banner" style="margin-bottom:16px"><span class="reward-icon">💰</span><div><strong>خزنتك</strong><p>🪙 ${fmt(u.coins)} كوين · 💎 ${fmt(u.gems)} جوهرة</p></div><span class="pill">افتراضي</span></div>
 <div class="shop-grid">${state.store.map(i=>{const owned=u.inventory.includes(i.id),equipped=u.equipped===i.id;return `<div class="shop-card"><span class="shop-image">${i.icon}</span><strong>${esc(i.name)}</strong><small>${i.currency==='coins'?'🪙':'💎'} ${fmt(i.price)} ${i.currency==='coins'?'كوين':'جوهرة'}</small><button class="btn ${equipped?'btn-secondary':owned?'btn-mint':'btn-primary'}" data-action="${owned?'equip':'buy'}" data-id="${i.id}" ${equipped?'disabled':''}>${equipped?'✓ مستخدم':owned?'استخدم الطقم':'شراء'}</button></div>`;}).join('')}</div><p class="footnote">كل المعروض عناصر تجميلية فقط. الرصيد مالوش قيمة نقدية ولا يمكن تحويله لفلوس.</p>`;}
function searchSection(){return `<div class="join-box"><input class="input" id="find-user" placeholder="دوّر على لاعب باسمه" value="${esc(state.searchQuery||'')}" maxlength="22"><button class="btn btn-primary" data-action="search-user">بحث</button></div>
 <div class="friend-list">${state.search.map(u=>`<div class="list-row">${avatar(u)}<div class="row-main"><strong>${esc(u.name)}</strong><small>🏆 ${fmt(u.wins)} فوز</small></div><button class="btn btn-secondary" data-action="friend-request" data-id="${u.id}">إضافة +</button></div>`).join('')}</div>`;}
function friendsSection(){return `<div class="section-head" style="margin-top:4px"><h3>أصحابك وطلبات الإضافة</h3><button class="mini-link" data-action="friends-refresh">تحديث ↻</button></div>
 ${state.friends.length?`<div class="friend-list">${state.friends.map(f=>`<div class="list-row">${avatar(f.user)}<div class="row-main"><strong>${esc(f.user.name)}</strong><small>${f.status==='pending'?f.incoming?'طلب إضافة جديد':'الطلب قيد الانتظار':'صاحبك'}</small></div>${f.status==='pending'&&f.incoming?`<button class="btn btn-mint" data-action="friend-accept" data-id="${f.user.id}">قبول</button>`:f.status==='accepted'?`<button class="btn btn-secondary" data-action="dm-open" data-id="${f.user.id}">رسالة 💬</button>`:''}</div>`).join('')}</div>`:`<div class="empty-state"><span class="big">🤝</span>لسه ما ضفتش صحاب.<br>دوّر على اسم لاعب وابعث له طلب صداقة.</div>`}`;}
function messageMarkup(m,isDm=false){const mine=(m.uid||m.sender)===state.me.id;return `<div class="msg ${mine?'me':''}"><span class="msg-ava">${esc(m.avatar||(mine?state.me.avatar:'💬'))}</span><div class="msg-box"><b>${esc(isDm?(mine?'إنت':'صاحبك'):(m.name||'لاعب'))}</b><span>${esc(m.text||m.body)}</span></div></div>`;}
function worldSection(){return `<div class="card"><div class="section-head" style="margin:0 0 10px"><h3>🌍 الشات العام</h3><span><i class="neon-dot"></i> مباشر</span></div><div class="world-messages" id="world-messages">${state.world.length?state.world.map(m=>messageMarkup(m)).join(''):'<div class="muted">ابدأ أنت السلام على الناس 👋</div>'}</div><form class="send-row" id="world-form"><input class="chat-input" id="world-input" maxlength="150" placeholder="اكتب رسالة لطيفة..." required><button class="btn btn-primary" type="submit">إرسال</button></form></div>`;}
function dmSection(){const friend=state.friends.find(f=>f.user.id===state.dmId)?.user;return `<button class="btn btn-secondary" data-action="dm-back" style="margin-bottom:12px">← رجوع</button><h3>${avatar(friend)} محادثة مع ${esc(friend?.name||'لاعب')}</h3><div class="world-messages" id="dm-messages">${state.dmMessages.map(m=>messageMarkup(m,true)).join('')}</div><form class="send-row" id="dm-form"><input class="chat-input" id="dm-input" maxlength="500" placeholder="رسالتك..." required><button class="btn btn-primary" type="submit">إرسال</button></form>`;}
function renderSocial(){return `<h1 class="page-title">💬 اللمة والصحاب</h1><p class="page-sub">اتعرف على لاعبين وابقى على تواصل معاهم حتى بعد الجولة.</p>
 ${state.socialMode!=='dm'?`<div class="tabs"><button data-social="friends" class="${state.socialMode==='friends'?'active':''}">👥 صحابي</button><button data-social="search" class="${state.socialMode==='search'?'active':''}">🔎 بحث</button><button data-social="world" class="${state.socialMode==='world'?'active':''}">🌍 عام</button></div>`:''}
 ${state.socialMode==='dm'?dmSection():state.socialMode==='friends'?friendsSection():state.socialMode==='search'?searchSection():worldSection()}`;}
function renderProfile(){const u=state.me;return `<h1 class="page-title">👤 صفحتي</h1><div class="profile-banner">${avatar(u,'large')}<h2>${esc(u.name)}</h2><small>مستوى ${fmt(Math.floor(u.xp/500)+1)} · سيجاوي أصيل</small><div class="profile-skin">الطقم الحالي: ${esc(state.store.find(i=>i.id===u.equipped)?.name||'الكلاسيكي')}</div></div>
 <div class="stat-row" style="margin-bottom:14px"><div class="stat"><b>${fmt(u.wins)}</b><small>فوز</small></div><div class="stat"><b>${fmt(u.losses)}</b><small>خسارة</small></div><div class="stat"><b>${fmt(u.draws)}</b><small>تعادل</small></div></div>
 <div class="card"><div class="section-head" style="margin:0 0 9px"><h3>تعديل حسابك</h3></div><form id="profile-form"><label class="field">اسمك في اللعبة<input name="name" maxlength="24" value="${esc(u.name)}" required></label><span class="muted">اختار صورتك</span><div class="avatar-options">${['🦁','👑','🐪','🦅','🐈','🪷','👸','🧑','🧕','👨','👩'].map(v=>`<button type="button" class="avatar-choice ${u.avatar===v?'chosen':''}" data-action="avatar" data-value="${v}">${v}</button>`).join('')}</div><button class="btn btn-mint full" type="submit">حفظ التغييرات</button></form></div>
 <div class="section-head"><h3>الإعدادات</h3></div><div class="card"><div class="settings-row"><div><strong>🔊 أصوات اللعبة</strong><div class="muted">تأثيرات التحريك والمكافآت</div></div><button class="switch ${u.settings.sound!==false?'on':''}" data-action="toggle-sound" aria-label="صوت اللعبة"></button></div><div class="settings-row"><div><strong>🎙️ الميكروفون</strong><div class="muted">اختياري وبإذنك داخل الغرفة</div></div><span>داخل اللعب</span></div><div class="settings-row"><div><strong>🔐 نوع الحساب</strong></div><span>${u.guest?'ضيف':u.email?'بريد / اجتماعي':'اجتماعي'}</span></div><div class="settings-row"><div><strong>📏 قواعد السيجا</strong></div><button data-action="rules" class="mini-link">اعرف القواعد</button></div><button data-action="logout" class="btn btn-outline full" style="margin-top:15px">تسجيل الخروج</button></div>`;}
function renderRanking(){return `<button data-action="rank-back" class="btn btn-secondary" style="margin-bottom:14px">← رجوع</button><h1 class="page-title">🏆 أبطال السيجا</h1><p class="page-sub">ترتيب اللاعبين حسب عدد مرات الفوز والخبرة.</p><div class="rank-list">${state.ranking.map((u,i)=>`<div class="list-row"><span class="rank-place">${fmt(i+1)}</span>${avatar(u)}<div class="row-main"><strong>${esc(u.name)}</strong><small>${fmt(u.xp)} XP</small></div><span class="pill">🏆 ${fmt(u.wins)}</span></div>`).join('')||'<div class="empty-state">لسه مفيش تصنيف</div>'}</div>`;}
function canMove(g,i,from){if(from===null)return false;if(g.board[i]!==0)return false;const r=Math.floor(i/5),c=i%5,fr=Math.floor(from/5),fc=from%5;return Math.abs(r-fr)+Math.abs(c-fc)===1;}
function renderRoom(){const r=state.room;if(!r)return '';const g=r.game,seat=r.players.findIndex(p=>p?.id===state.me.id),enemy=seat===0?1:0,active=g.turn===seat,selected=g.chainIndex!==null&&active?g.chainIndex:state.selected;
 const legalH=active&&g.phase==='placement'?g.board.flatMap((v,i)=>v===0&&i!==12?[i]:[]):active&&selected!==null?g.board.flatMap((v,i)=>v===0&&canMove(g,i,selected)?[i]:[]):[];
 let turnText='';if(r.status==='waiting')turnText='مستنيين لاعب تاني يدخل بالكود';else if(r.status==='finished')turnText='الجولة خلصت';else if(active)turnText=g.phase==='placement'?`دورك: حُط الحجر رقم ${g.stepInTurn+1} من ٢`:g.chainIndex!==null?'أكلت حجر! كمل حركة أكل تانية':'دورك: اختار حجر وحرّكه مربع واحد';else turnText=g.phase==='placement'?'دور المنافس في الرصّ':'استنى المنافس يحرك حجاره';
 return `<div class="room-header"><button class="btn btn-secondary" data-action="leave-room">❮ خروج</button><div class="room-title">${cap(r.kind)} <span class="pill">${esc(r.id)}</span></div><button class="btn btn-outline" data-action="share-room">🔗 دعوة</button></div>
 ${r.status==='waiting'?`<div class="wait-panel">🎉 أوضة جاهزة! ابعت الكود <strong>${r.id}</strong> لصحبك.<br>${btn('📋 انسخ لينك الدعوة','share-room','btn-mint')}</div>`:''}
 ${r.status==='finished'?`<div class="room-result"><strong>${g.winner==='draw'?'🤝 تعادل':g.winner===seat?'🎉 مبروك يا ملك!':'🏆 الجولة خلصت'}</strong>${g.winner==='draw'?'جولة متكافئة':g.winner===seat?'أنت اللي كسبت':'المنافس كسب الجولة'}<div style="margin-top:10px">${btn('العب جولة جديدة','bot','btn-primary')}</div></div>`:''}
 <div class="room-card"><div class="versus">${[0,1].map((i)=>`<div class="seat ${g.turn===i&&r.status==='playing'?'current':''}">${avatar(r.players[i])}<div><strong>${esc(r.players[i]?.name||'مكان فاضي')}</strong><small>${i===seat?'إنت':r.players[i]?'المنافس':'مستني'} · ${g.phase==='placement'?fmt(g.placed[i]):fmt(g.board.filter(v=>v===i+1).length)} حجر</small></div></div>${i===0?'<div class="vs-bubble">VS</div>':''}`).join('')}</div>
 <div class="board-shell"><div class="board" role="grid" aria-label="لوحة السيجا المصرية">${g.board.map((v,i)=>{const owner=v-1,skin=v?r.players[owner]?.equipped||'classic':'';return `<button role="gridcell" aria-label="المربع ${i+1}${v?' محجوز':''}" class="cell ${i===12?'center':''} ${legalH.includes(i)?'hint':''} ${selected===i?'selected':''} ${g.lastMove?.to===i?'just-played':''}" data-action="cell" data-cell="${i}" ${r.status!=='playing'||g.winner!==null?'disabled':''}>${v?`<span class="stone ${v===1?'light':'dark'} ${esc(skin)}">${skin==='gold'?'✦':skin==='emerald'?'✧':skin==='pharaoh'?'𓂀':skin==='fire'?'♨':skin==='royal'?'❖':''}</span>`:''}</button>`;}).join('')}</div></div>
 <div class="board-caption"><span>🟡 ${g.phase==='placement'?'اتحطّ': 'فاضل'}: ${fmt(g.phase==='placement'?g.placed[0]:g.board.filter(v=>v===1).length)}</span><span>${g.phase==='placement'?'مرحلة الرصّ':'مرحلة التحريك والأكل'}</span><span>⚫ ${g.phase==='placement'?'اتحطّ':'فاضل'}: ${fmt(g.phase==='placement'?g.placed[1]:g.board.filter(v=>v===2).length)}</span></div><div class="turn-hint">${esc(turnText)}</div></div>
 <div class="room-actions"><button class="btn ${state.voice?'voice-active':'btn-secondary'}" data-action="voice" ${r.status!=='playing'||r.players.some(p=>p?.id==='bot')?'disabled':''}>${state.voice?'🎙️ المايك شغال':'🎤 افتح الصوت'}</button><button class="btn btn-secondary" data-action="rules">📜 القواعد</button><button class="btn btn-secondary" data-action="share-room">🔗 مشاركة</button></div>
 <section class="card room-chat"><div class="section-head"><h3>💬 شات الجولة</h3><span>خليك لطيف مع المنافس</span></div><div class="world-messages" id="room-messages">${r.chat?.length?r.chat.map(m=>messageMarkup(m)).join(''):'<div class="muted">قول أهلا لمنافسك 👋</div>'}</div><form class="send-row" id="room-chat-form"><input id="room-chat-input" class="chat-input" placeholder="اكتب رسالة..." maxlength="200" required><button class="btn btn-primary">إرسال</button></form></section>`;}
function render(){if(!state.me)return;wallet();const main=$('#main');main.innerHTML=state.room?renderRoom():state.tab==='home'?renderHome():state.tab==='rooms'?renderRooms():state.tab==='store'?renderStore():state.tab==='social'?renderSocial():state.tab==='profile'?renderProfile():state.tab==='ranking'?renderRanking():renderHome();$('#nav').classList.toggle('hidden',!!state.room);$('#topbar').classList.toggle('hidden',!!state.room);const chats=['#world-messages','#room-messages','#dm-messages'];for(const id of chats){const el=$(id);if(el)el.scrollTop=el.scrollHeight;}}
async function refresh(tab){try{if(tab==='rooms'){state.rooms=(await api('/rooms')).rooms;}if(tab==='store'){state.store=(await api('/store')).items;}if(tab==='social'){state.friends=(await api('/friends')).friends;}if(tab==='ranking'){state.ranking=(await api('/leaderboard')).users;}}catch(e){toast(e.message);}render();}
function startSocket(){if(state.socket){state.socket.disconnect();}const s=state.socket=io({transports:['websocket','polling']});s.on('connect_error',()=>toast('الشات المباشر غير متصل. حاول تحدّث الصفحة.'));
 s.on('room:update',r=>{if(!state.room||state.room.id!==r.id)return;const old=state.room.game?.moves;state.room=r;if(old!==r.game.moves)sound();render();});
 s.on('lobby:update',()=>{if(!state.room&&state.tab==='rooms')refresh('rooms');});
 s.on('chat:new',m=>{if(!state.room)return;state.room.chat=[...(state.room.chat||[]),m].slice(-60);const el=$('#room-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('world:new',m=>{state.world.push(m);state.world=state.world.slice(-70);const el=$('#world-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('dm:new',m=>{if(state.dmId===(m.sender===state.me.id?m.receiver:m.sender)){state.dmMessages.push(m);const el=$('#dm-messages');if(el){el.innerHTML+=messageMarkup(m,true);el.scrollTop=el.scrollHeight;}}});
 s.on('wallet:update',u=>{if(u?.id===state.me.id){setMe(u);if(!state.room)render();}});
 s.on('voice:peer-joined',({uid})=>{toast('منافسك دخل المايك');});
 s.on('voice:peer-left',()=>{closePeer();toast('منافسك قفل المايك');});
 s.on('voice:signal',onVoiceSignal);
 s.on('reconnect',()=>{if(state.room)subscribeRoom();});
}
function subscribeRoom(){if(!state.socket?.connected||!state.room)return;state.socket.emit('room:subscribe',{id:state.room.id},r=>{if(r?.room){state.room=r.room;render();}});}
async function enterRoom(r){state.selected=null;state.room=r;state.voice=false;render();if(state.socket.connected)subscribeRoom();else state.socket.once('connect',subscribeRoom);window.history.replaceState({},'',`/room/${r.id}`);window.scrollTo(0,0);}
async function createRoom(kind){const data=await post(kind==='bot'?'/bot':kind==='quick'?'/quick':'/rooms',kind==='bot'||kind==='quick'?{}:{kind});enterRoom(data.room);}
async function joinRoom(id){if(!id||id.length!==6)throw Error('اكتب كود الغرفة المكون من ٦ رموز');const data=await post(`/rooms/${id.toUpperCase()}/join`);enterRoom(data.room);}
async function leaveRoom(){if(!state.room)return;await voiceOff();const id=state.room.id;try{await post(`/rooms/${id}/leave`);}catch{}state.room=null;window.history.replaceState({},'','/');view('home');}
function shareRoom(){const r=state.room;if(!r)return;const url=`${location.origin}/room/${r.id}`;if(navigator.share){navigator.share({title:'تعالى نلعب سيجا',text:'تعالى قابلني في سيجا رويال 🎲',url}).catch(()=>{});}else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>toast('نسخت لينك الغرفة! 📋')).catch(()=>showLink(url));}else showLink(url);}
function showLink(url){openModal('لينك دعوة صاحبك',`<input class="input" readonly value="${esc(url)}" onclick="this.select()"><p class="muted">انسخ اللينك وابعته في أي شات.</p>`);}
function openModal(title,body){$('#modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><span>${esc(title)}</span><button class="close-x" data-action="close-modal">×</button></div>${body}</div></div>`;}
function closeModal(){$('#modal-root').innerHTML='';}
function showRules(){openModal('📜 قواعد السيجا المصرية',`<p class="muted">بتتلعب السيجا على لوحة ٥×٥، كل لاعب معاه ١٢ حجر.</p><div class="card" style="font-size:12px;line-height:2"><b>١. الرصّ</b><br>كل لاعب بيحط حجرين في دوره، مع ترك المربع اللي في النص فاضي لحد نهاية الرصّ.<br><b>٢. التحريك</b><br>حرّك حجر واحد مربع واحد فوق أو تحت أو يمين أو شمال. ممنوع الحركة بالقطر.<br><b>٣. الأكل</b><br>حاصر حجر الخصم بين حجرين من حجارتك في خط مستقيم. المربع اللي في النص آمن من الأكل.<br><b>٤. حركة إضافية</b><br>لو أكلت حجر، تقدر تكمل بنفس الحجر لو فيه أكل تاني.<br><b>٥. الفوز</b><br>اللي ياكل حجارة منافسه كلها يكسب. ولو اللعب قفل، الأكثر حجارة يفوز.</div><p class="footnote">دي نسخة شائعة من قواعد السيجا؛ فيه اختلافات شعبية بسيطة بين المناطق.</p>`);}
function emit(event,payload,cb){return new Promise((resolve,reject)=>{if(!state.socket?.connected)return reject(Error('الاتصال المباشر مقطوع'));state.socket.emit(event,payload,ans=>{if(ans?.error)reject(Error(ans.error));else resolve(ans||{});});});}
async function doCell(i){const r=state.room,g=r?.game;if(!r||r.status!=='playing'||g.winner!==null)return;const p=r.players.findIndex(u=>u?.id===state.me.id);
 if(g.turn!==p)return toast('استنى دورك يا ملك');let action;
 if(g.phase==='placement'){action={kind:'place',to:i};}
 else {if(g.chainIndex!==null)state.selected=g.chainIndex;
   if(g.board[i]===p+1){if(g.chainIndex!==null&&i!==g.chainIndex)return toast('كمل بنفس الحجر اللي أكل');state.selected=i;return render();}
   if(state.selected===null)return toast('اختار حجر من حجارتك الأول');action={kind:'move',from:state.selected,to:i};}
 try{await emit('game:action',{id:r.id,action});state.selected=null;}catch(e){toast(e.message);}}
const avatars=['🦁','👑','🐪','🦅','🐈','🪷','👸','🧑','🧕','👨','👩'];
async function clickAction(b){const a=b.dataset.action,id=b.dataset.id;try{
 if(['bot','quick','private','public','vip'].includes(a)){await createRoom(a);return;}
 if(a==='daily'){const v=await post('/daily');setMe(v.user);sound();toast('مبروك! +٤٥٠ كوين و+١٠ جواهر 🎁');render();}
 else if(a==='join-code')await joinRoom($('#join-code')?.value.trim()||'');
 else if(a==='join')await joinRoom(id);
 else if(a==='refresh-rooms')await refresh('rooms');
 else if(a==='buy'){const v=await post('/store/buy',{id});setMe(v.user);toast('مبروك! الطقم الجديد بقى عندك');render();}
 else if(a==='equip'){const v=await post('/store/equip',{id});setMe(v.user);toast('اتغير الطقم بنجاح');render();}
 else if(a==='ranking'){state.tab='ranking';await refresh('ranking');}
 else if(a==='rank-back')view('home');
 else if(a==='search-user'){state.searchQuery=$('#find-user').value.trim();state.search=(await api('/users/search?q='+encodeURIComponent(state.searchQuery))).users;render();}
 else if(a==='friend-request'){const r=await post('/friends/request',{id});toast(r.ok?'بعتنا طلب الإضافة 🤝':'الطلب موجود بالفعل');}
 else if(a==='friend-accept'){const r=await post('/friends/accept',{id});if(r.ok){toast('بقيتوا صحاب 🎉');await refresh('social');}else toast('مافيش طلب صالح');}
 else if(a==='friends-refresh')await refresh('social');
 else if(a==='dm-open'){state.dmId=id;state.socialMode='dm';state.dmMessages=(await api('/dm/'+id)).messages;render();}
 else if(a==='dm-back'){state.socialMode='friends';render();}
 else if(a==='avatar'){if(!avatars.includes(b.dataset.value))return;const u=await patch('/me',{avatar:b.dataset.value});setMe(u.user);render();}
 else if(a==='toggle-sound'){const u=await patch('/me',{settings:{sound:state.me.settings.sound===false}});setMe(u.user);render();}
 else if(a==='rules')showRules();
 else if(a==='close-modal')closeModal();
 else if(a==='logout'){if(state.room)await leaveRoom();await voiceOff();await post('/auth/logout');state.socket?.disconnect();state.me=null;$('#auth-cover').classList.remove('hidden');view('home');}
 else if(a==='cell')await doCell(Number(b.dataset.cell));
 else if(a==='share-room')shareRoom();
 else if(a==='leave-room')await leaveRoom();
 else if(a==='voice'){if(state.voice)await voiceOff();else await voiceOn();render();}
 }catch(e){toast(e.message);}}
async function onForm(form){try{if(form.id==='profile-form'){const v=await patch('/me',{name:new FormData(form).get('name')});setMe(v.user);toast('اتحفظت التغييرات');render();}
 else if(form.id==='room-chat-form'){const input=$('#room-chat-input'),text=input.value.trim();if(!text)return;await emit('chat:send',{id:state.room.id,text});input.value='';}
 else if(form.id==='world-form'){const input=$('#world-input'),text=input.value.trim();if(!text)return;await emit('world:send',{text});input.value='';}
 else if(form.id==='dm-form'){const input=$('#dm-input'),text=input.value.trim();if(!text)return;await emit('dm:send',{to:state.dmId,text});input.value='';}
 }catch(e){toast(e.message);}}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-tab]');if(nav){if(state.room)return;const tab=nav.dataset.tab;view(tab);refresh(tab);return;}const social=e.target.closest('[data-social]');if(social){state.socialMode=social.dataset.social;render();return;}const b=e.target.closest('[data-action]');if(b){clickAction(b);return;}if(e.target.id==='modal-backdrop')closeModal();});
document.addEventListener('submit',e=>{if(e.target.id==='auth-form')return;e.preventDefault();onForm(e.target);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
function closePeer(){try{state.peer?.close();}catch{}state.peer=null;const audio=$('#remote-voice');if(audio)audio.remove();state.iceQueue=[];}
function buildPeer(remoteId){closePeer();const pc=state.peer=new RTCPeerConnection({iceServers:state.config.iceServers});
 for(const track of state.localStream.getTracks())pc.addTrack(track,state.localStream);
 pc.onicecandidate=e=>{if(e.candidate)state.socket.emit('voice:signal',{id:state.room.id,to:remoteId,data:{candidate:e.candidate}});};
 pc.ontrack=e=>{let el=$('#remote-voice');if(!el){el=document.createElement('audio');el.id='remote-voice';el.autoplay=true;el.playsInline=true;document.body.appendChild(el);}el.srcObject=e.streams[0];el.play().catch(()=>toast('اضغط أي مكان لتشغيل صوت المنافس'));};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')toast('تعذّر اتصال الصوت. قد يحتاج إعداد TURN');};return pc;}
async function voiceOn(){if(!state.room||state.room.status!=='playing'||state.room.players.some(p=>p?.id==='bot'))throw Error('الصوت متاح للجولات بين لاعبين حقيقيين');
 if(!navigator.mediaDevices?.getUserMedia)throw Error('لازم تفتح الموقع بـ HTTPS علشان الميكروفون يشتغل');
 state.localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
 try{const r=await emit('voice:join',{id:state.room.id});state.voice=true;toast('🎤 المايك شغال — اضغط تاني للقفل');
  if(r.peers?.length){const pc=buildPeer(r.peers[0]);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await emit('voice:signal',{id:state.room.id,to:r.peers[0],data:{sdp:pc.localDescription}});}
 }catch(e){await voiceOff();throw e;}
}
async function onVoiceSignal({id,from,data}){if(!state.voice||!state.room||state.room.id!==id)return;try{
 const pc=state.peer||buildPeer(from);
 if(data.sdp){await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));for(const c of state.iceQueue)await pc.addIceCandidate(c);state.iceQueue=[];
  if(data.sdp.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);state.socket.emit('voice:signal',{id,to:from,data:{sdp:pc.localDescription}});}}
 else if(data.candidate){if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(data.candidate));else state.iceQueue.push(new RTCIceCandidate(data.candidate));}
 }catch(e){console.warn('Voice signaling',e);toast('اتصال الصوت اتعطّل');}}
async function voiceOff(){if(state.room)state.socket?.emit('voice:leave',{id:state.room.id});for(const track of state.localStream?.getTracks()||[])track.stop();state.localStream=null;state.voice=false;closePeer();}
function authView(v){state.authView=v;document.querySelectorAll('[data-auth-view]').forEach(b=>b.classList.toggle('selected',b.dataset.authView===v));$('#auth-name-wrap').classList.toggle('hidden',v==='login');$('#auth-submit').textContent=v==='login'?'يلا ندخل نلعب':'أنشئ حسابي';$('#auth-form [name="password"]').autocomplete=v==='login'?'current-password':'new-password';}
async function authReady(u){setMe(u);$('#auth-cover').classList.add('hidden');startSocket();state.config=await api('/config');state.store=state.config.items;const id=location.pathname.match(/^\/(?:room|invite)\/([A-Za-z0-9]{6})$/)?.[1];if(id){try{await joinRoom(id);}catch(e){toast(e.message);window.history.replaceState({},'','/');view('home');}}else view('home');}
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{const r=await post(state.authView==='login'?'/auth/login':'/auth/register',data);await authReady(r.user);}catch(ex){toast(ex.message);}});
document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>authView(b.dataset.authView)));
$('#guest-login').addEventListener('click',async()=>{try{const name=prompt('اسمك في اللعبة؟','لاعب سيجا')||'ضيف سيجا';const r=await post('/auth/guest',{name});await authReady(r.user);}catch(e){toast(e.message);}});
$('#google-login').addEventListener('click',()=>{if(!state.config?.providers.google)return toast('دخول جوجل محتاج إعداد حساب المطور على السيرفر');location.href='/api/auth/google/start';});
$('#facebook-login').addEventListener('click',()=>{if(!state.config?.providers.facebook)return toast('دخول فيسبوك محتاج إعداد تطبيق المطور على السيرفر');location.href='/api/auth/facebook/start';});
(async function boot(){try{state.config=await api('/config');state.store=state.config.items;const r=await api('/me');if(r.user)await authReady(r.user);else $('#auth-cover').classList.remove('hidden');if(location.search.includes('autherror'))toast('فشل الدخول الاجتماعي؛ راجع الإعدادات');}catch(e){toast('مش قادر أتصل بالسيرفر — '+e.message);}})();