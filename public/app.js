import {variantActions,chineseLayout,GAME_CATALOG} from './variants.js';
import {effect,startMusic,stopMusic,isMusicOn,unlockAudio} from './soundscape.js';
import {mount3D} from './scene3d.js';
import {firebaseReady,firebaseSignIn} from './firebase-auth.js';
const $=sel=>document.querySelector(sel);
const fmt=n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(n??0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={me:null,tab:'home',room:null,rooms:[],store:[],config:null,friends:[],ranking:[],search:[],world:[],socket:null,selected:null,authView:'login',socialMode:'friends',dmId:null,dmMessages:[],voice:false,localStream:null,peer:null,iceQueue:[],busy:false,boardSize:[5,7,9].includes(Number(localStorage.getItem('seega_board_size')))?Number(localStorage.getItem('seega_board_size')):5,gameMode:localStorage.getItem('seega_game_mode')||'seega5',boardTilt:true,chatOpen:false,rankFilter:'coins',captureFx:null,giftFx:null,giftMenuOpen:false,lastFxSeq:null};
let toastTimer=null;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3100);}
async function api(path,options={}){const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...options});let data;try{data=await r.json();}catch{data={};}if(!r.ok)throw Error(data.error||'حصلت مشكلة في الاتصال');return data;}
const post=(path,data={})=>api(path,{method:'POST',body:JSON.stringify(data)});
const patch=(path,data={})=>api(path,{method:'PATCH',body:JSON.stringify(data)});
function wallet(){if(!state.me)return;$('#coin-count').textContent=fmt(state.me.coins);$('#gem-count').textContent=fmt(state.me.gems);}
function playerName(){return state.me?.name||'يا بطل';}
const tones={ruby:['أحمر','🔴'],ocean:['أزرق','🔵'],sun:['أصفر','🟡'],jade:['أخضر','🟢']};
function avatar(user,cls=''){
 const photo=user?.photo;
 if(typeof photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)&&photo.length<170000)
  return `<span class="avatar-icon ${cls}"><img alt="الصورة الشخصية" class="avatar-photo" src="${photo}"></span>`;
 return `<span class="avatar-icon ${cls}">${esc(user?.avatar||'🎮')}</span>`;
}
function colorButton(seat,color,selected,enabled=true,blocked=false){return `<button type="button" class="tone-choice tone-${color} ${selected===color?'chosen':''} ${blocked?'unavailable':''}" data-action="seat-color" data-seat="${seat}" data-color="${color}" ${!enabled||blocked?'disabled':''} aria-label="لون ${tones[color][0]}" title="${tones[color][0]}"><span></span></button>`;}

function sound(){effect('move',state.me?.settings?.sound!==false);}

let giftAudioContext=null;
function unlockGiftAudio(){
 if(state.me?.settings?.sound===false)return;
 try{giftAudioContext??=new (window.AudioContext||window.webkitAudioContext)();if(giftAudioContext.state==='suspended')giftAudioContext.resume().catch(()=>{});}catch{}
}
function playGiftSound(id){
 if(state.me?.settings?.sound===false)return;
 unlockGiftAudio();const ctx=giftAudioContext;if(!ctx)return;
 const now=ctx.currentTime;
 const tone=(freq,delay,duration,volume=.09,type='sine',finish=freq)=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain(),t=now+delay;
  osc.type=type;osc.frequency.setValueAtTime(Math.max(30,freq),t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30,finish),t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duration+.02);
 };
 const noise=(duration,volume,cutoff,delay=0)=>{
  const count=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,count,ctx.sampleRate),a=buffer.getChannelData(0);
  for(let i=0;i<count;i++)a[i]=(Math.random()*2-1)*(1-i/count);
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),t=now+delay;
  src.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,t);
  gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);src.start(t);
 };
 switch(id){
  case 'egg':tone(190,.0,.11,.18,'triangle',65);noise(.22,.21,2900,.02);noise(.085,.1,5800,.1);break;
  case 'hammer':tone(220,.0,.13,.17,'triangle',48);tone(980,.035,.48,.11,'square',460);tone(1340,.06,.3,.035,'sine',900);break;
  case 'water':case 'splash':noise(.72,.23,1700);noise(.25,.1,4100,.16);tone(230,.05,.32,.045,'sine',85);break;
  case 'cake':for(const [i,n] of [392,494,587,784].entries())tone(n,i*.13,.4,.085,'sine',n*.98);noise(.1,.08,3200,.5);break;
  case 'heart':for(const [i,n] of [660,880,1046].entries())tone(n,i*.12,.48,.075,'sine',n*.99);break;
  case 'rose':tone(560,0,.38,.065);tone(840,.13,.5,.07);break;
  case 'confetti':noise(.2,.15,5500);tone(600,.03,.25,.1,'triangle',1000);break;
  default:tone(480,0,.2,.09,'sine',800);
 }
}
function animateGiftToAvatar(gift){
 const source=document.querySelector(`.duel-avatar[data-seat="${gift.from}"] .avatar-icon, .variant-user[data-seat="${gift.from}"] .avatar-icon`);
 const target=document.querySelector(`.duel-avatar[data-seat="${gift.to}"] .avatar-icon, .variant-user[data-seat="${gift.to}"] .avatar-icon`);
 if(!source||!target)return;
 const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
 const sx=a.left+a.width/2,sy=a.top+a.height/2,dx=b.left+b.width/2-sx,dy=b.top+b.height/2-sy;
 const layer=document.createElement('div');layer.className='gift-fx-layer';layer.setAttribute('aria-hidden','true');
 const projectile=document.createElement('span');projectile.className='flying-gift';projectile.textContent=gift.emoji;
 projectile.style.left=sx+'px';projectile.style.top=sy+'px';layer.append(projectile);document.body.append(layer);
 const duration=1080;
 projectile.animate([
  {transform:'translate(-50%,-50%) scale(.45) rotate(-25deg)',opacity:.25,offset:0},
  {transform:`translate(calc(-50% + ${dx*.42}px),calc(-50% + ${dy*.40-105}px)) scale(1.35) rotate(-10deg)`,opacity:1,offset:.48},
  {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.88) rotate(30deg)`,opacity:1,offset:.88},
  {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.2) rotate(75deg)`,opacity:0,offset:1}
 ],{duration,easing:'ease-in-out',fill:'forwards'});
 setTimeout(()=>{
  playGiftSound(gift.id);
  if(!target.isConnected)return;
  target.classList.remove('gift-impact');void target.offsetWidth;target.classList.add('gift-impact');
  const badge=document.createElement('span');badge.className='gift-impact-emoji';badge.textContent=gift.emoji;
  const latest=target.getBoundingClientRect();badge.style.left=latest.left+latest.width/2+'px';badge.style.top=latest.top+latest.height/2+'px';layer.append(badge);
  const particles=gift.id==='water'||gift.id==='splash'?['💦','💧','💦','💧','🫧','💧']:
   gift.id==='egg'?['💥','🥚','✨','💥','✨','🥚']:gift.id==='cake'?['🎉','✨','🎂','🎊','✨','🎉']:
   gift.id==='hammer'?['💥','⚡','✨','⚡','💥','✨']:['✨',gift.emoji,'✨',gift.emoji,'⭐','✨'];
  particles.forEach((emoji,i)=>{
   const span=document.createElement('span');span.textContent=emoji;span.className='gift-particle';span.style.left=latest.left+latest.width/2+'px';span.style.top=latest.top+latest.height/2+'px';layer.append(span);
   const angle=(i/particles.length)*Math.PI*2-1.1,dist=49+(i%3)*14;
   span.animate([{transform:'translate(-50%,-50%) scale(.35)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(1.15) rotate(${i*45}deg)`,opacity:0}],{duration:900,fill:'forwards',easing:'ease-out'});
  });
  setTimeout(()=>target.classList.remove('gift-impact'),850);
 },duration*.86);
 setTimeout(()=>layer.remove(),duration+1300);
}
function setMe(u){state.me=u;wallet();}
function view(tab){state.tab=tab;state.room=null;state.selected=null;$('#topbar').classList.remove('hidden');$('#nav').classList.remove('hidden');document.querySelectorAll('[data-tab]').forEach(b=>{if(b.classList.contains('nav-item'))b.classList.toggle('active',b.dataset.tab===tab);});render();window.scrollTo(0,0);}
function btn(text,action,cls='btn-primary'){return `<button class="btn ${cls}" data-action="${action}">${text}</button>`;}
function cap(k){return {local:'على نفس الجهاز',online:'أونلاين مباشر',private:'خاصة',public:'عامة',vip:'ملكية VIP',quick:'تحدّي سريع',bot:'ضد الكمبيوتر'}[k]||k;}
function renderHome(){const u=state.me;return `<div class="demo-banner">🎲 ٦ ألعاب متاحة • غرف لعب بين جهازين بكود دعوة (تجريبية) • اللعب بدون حساب</div><section class="welcome"><div><div class="eyebrow">أهلًا بيك في اللمة</div><h2>منورنا يا ${esc(u.name)} 👋</h2><p>جاهز تكسب الجولة الجاية؟</p></div>${avatar(u)}</section>
 <section class="hero"><div class="spark">✨</div><span class="little-tag">🏆 ألعاب الطاولة الملكية 3D</span><h1>حُط الحجر<br>واكسب <em>التحدّي!</em></h1><p>طاولة خشب ملكية وتأثيرات صوتية، وسيجا مصرية وداما أمريكية وصينية. تحدى صاحبك بكود غرفة.</p>${btn('⚔️ ابدأ اللعب','bot')}</section>
 <section class="reward-banner"><span class="reward-icon">🎁</span><div><strong>هديتك اليومية مستنياك</strong><p>٤٥٠ كوين + ١٠ جواهر كل يوم</p></div>${btn('استلم','daily','btn-mint')}</section>
 <section class="game-catalog"><div class="section-head"><h3>🎮 اختار اللعبة</h3><span>٦ أنواع قابلة للعب</span></div><div class="game-cards">${GAME_CATALOG.map(x=>`<button class="game-choice ${state.gameMode===x.id?'active':''}" data-action="game-mode" data-mode="${x.id}"><span class="game-icon">${x.icon}</span><strong>${x.name}</strong><small>${x.sub}</small></button>`).join('')}</div></section>
 <div class="audio-home-row"><button type="button" data-action="toggle-music" class="btn btn-secondary">${state.me?.settings?.music?'🎵 إيقاف الموسيقى':'🎶 تشغيل الموسيقى'}</button><button type="button" data-action="test-audio" class="btn btn-mint">🔊 اختبار الصوت</button><span class="board-3d-badge">✦ طاولة 3D ثابتة</span></div>
 <div class="section-head"><h3>اختار طريقة اللعب</h3><span>كل الطرق مجانية*</span></div><div class="mode-grid">
 <button data-action="bot" class="mode-card teal"><span class="mode-icon">🤖</span><strong>العب مع رمسيس</strong><small>الكمبيوتر مستنيك</small></button>
 <button data-action="local" class="mode-card red"><span class="mode-icon">👥</span><strong>اتنين على موبايل واحد</strong><small>كل واحد بلونه • بدون إنترنت</small></button>
 <button data-action="quick" class="mode-card red"><span class="mode-icon">⚡</span><strong>غرفة أونلاين جديدة</strong><small>شارك الكود مع صاحبك</small></button>
 <button data-action="private" class="mode-card blue"><span class="mode-icon">👥</span><strong>ادعُ صاحبك</strong><small>لينك يعمل بين جهازين</small></button>
 <button data-action="vip" class="mode-card gold"><span class="mode-icon">👑</span><strong>غرفة خاصة</strong><small>العب من أي مكان</small></button>
 </div><div class="section-head"><h3>أرقامك يا بطل</h3><button class="mini-link" data-action="ranking">🏆 الترتيب</button></div>
 <div class="stat-row"><div class="stat"><b>${fmt(u.wins)}</b><small>مكسب</small></div><div class="stat"><b>${fmt(u.xp)}</b><small>نقطة خبرة</small></div><div class="stat"><b>${fmt(u.totalCaptures||0)}</b><small>أكلت كام حجر</small></div></div>
 <p class="footnote">*الكوينز والجواهر عملات تجريبية محفوظة في المتصفح فقط وليست فلوس حقيقية.</p>`;}
function renderRooms(){return `<h1 class="page-title">🎲 صالة اللعب</h1><p class="page-sub">اعمل غرفة بكود، وسيب الصفحة مفتوحة وابعت اللينك لصاحبك. اتصال P2P تجريبي وممكن يفشل على بعض الشبكات.</p>
 <div class="join-box"><input id="join-code" class="input" placeholder="كود الغرفة — مثل ABC123" maxlength="6" autocomplete="off" aria-label="كود الغرفة">${btn('ادخل الغرفة','join-code')}</div>
 <div class="mode-grid" style="margin-bottom:15px"><button class="mode-card teal" data-action="private"><span class="mode-icon">🎲</span><strong>إنشاء غرفة</strong><small>انسخ كود الدعوة</small></button><button class="mode-card gold" data-action="private"><span class="mode-icon">👑</span><strong>تحدي مباشر</strong><small>على نفس اللعبة المختارة</small></button></div>
 <div class="section-head"><h3>الغرف المفتوحة</h3><button class="mini-link" data-action="refresh-rooms">تحديث ↻</button></div>
 <div class="room-list">${state.rooms.length?state.rooms.map(r=>`<div class="list-row">${avatar(r.owner)}<div class="row-main"><strong>${esc(r.owner?.name||'لاعب')}</strong><small>كود: ${esc(r.id)} · ${cap(r.kind)}</small></div><button class="btn btn-primary" data-action="join" data-id="${r.id}">انضم</button></div>`).join(''):`<div class="empty-state"><span class="big">🎲</span>لسه مفيش غرف عامة مستنية لاعبين<br>اعمل غرفة وخلي غيرك ينضم!</div>`}</div>
 <div class="section-head"><h3>خُد صاحبك لوحدكم</h3></div>${btn('🔒 اعمل غرفة بكود خاص','private','btn-secondary full')}`;}
function renderStore(){const u=state.me;return `<h1 class="page-title">🛍️ السوق الملكي</h1><p class="page-sub">زيّن حجارتك واختار طقم يميزك في كل جولة.</p>
 <div class="reward-banner" style="margin-bottom:16px"><span class="reward-icon">💰</span><div><strong>خزنتك</strong><p>🪙 ${fmt(u.coins)} كوين · 💎 ${fmt(u.gems)} جوهرة</p></div><span class="pill">افتراضي</span></div>
 <div class="shop-grid">${state.store.map(i=>{const owned=u.inventory.includes(i.id),equipped=u.equipped===i.id;return `<div class="shop-card"><span class="shop-image">${i.icon}</span><strong>${esc(i.name)}</strong><small>${i.currency==='coins'?'🪙':'💎'} ${fmt(i.price)} ${i.currency==='coins'?'كوين':'جوهرة'}</small><button class="btn ${equipped?'btn-secondary':owned?'btn-mint':'btn-primary'}" data-action="${owned?'equip':'buy'}" data-id="${i.id}" ${equipped?'disabled':''}>${equipped?'✓ مستخدم':owned?'استخدم الطقم':'شراء'}</button></div>`;}).join('')}</div><p class="footnote">كل المعروض عناصر تجميلية فقط. الرصيد مالوش قيمة نقدية ولا يمكن تحويله لفلوس.</p>`;}
function searchSection(){return `<div class="demo-banner">🪪 حفظ الـID متاح على الجهاز فقط؛ طلبات الصداقة بين الموبايلات محتاجة سيرفر مركزي.</div>
 <div class="join-box"><input class="input" id="find-user" placeholder="SG-XXXXXXXXXX" maxlength="13" autocomplete="off"><button class="btn btn-primary" data-action="save-contact">حفظ ID</button></div>
 <p class="muted">انسخ رقم صاحبك من صفحته واحفظه عندك. الحفظ مش بيبعت طلب صداقة فعلي.</p>`;}
function friendsSection(){return `<div class="section-head" style="margin-top:4px"><h3>معرّفات أصحابك المحفوظة</h3><button class="mini-link" data-action="friends-refresh">تحديث ↻</button></div>
 ${state.friends.length?`<div class="friend-list">${state.friends.map(f=>`<div class="list-row">${avatar(f.user)}<div class="row-main"><strong>${esc(f.user.name)}</strong><small>${esc(f.user.id)} · محفوظ محليًا فقط</small></div><span class="pill">🪪</span></div>`).join('')}</div>`:`<div class="empty-state"><span class="big">🤝</span>لسه مفيش معرّفات محفوظة.<br>اكتب ID صاحبك في البحث علشان تحتفظ بيه.</div>`}`;}
function messageMarkup(m,isDm=false){const mine=(m.uid||m.sender)===state.me.id;if(m.kind==='gift')return `<div class="msg gift-chat-bubble ${mine?'me':''}" aria-label="هدية مرسلة"><span class="gift-chat-emoji" aria-label="${esc(m.giftName||'هدية')}">${esc(m.emoji||'🎁')}</span></div>`;return `<div class="msg ${mine?'me':''}"><span class="msg-ava">${esc(m.avatar||(mine?state.me.avatar:'💬'))}</span><div class="msg-box"><b>${esc(isDm?(mine?'إنت':'صاحبك'):(m.name||'لاعب'))}</b><span>${esc(m.text||m.body)}</span></div></div>`;}
function worldSection(){return `<div class="card"><div class="section-head" style="margin:0 0 10px"><h3>🌍 الشات العام</h3><span><i class="neon-dot"></i> مباشر</span></div><div class="world-messages" id="world-messages">${state.world.length?state.world.map(m=>messageMarkup(m)).join(''):'<div class="muted">ابدأ أنت السلام على الناس 👋</div>'}</div><form class="send-row" id="world-form"><input class="chat-input" id="world-input" maxlength="150" placeholder="اكتب رسالة لطيفة..." required><button class="btn btn-primary" type="submit">إرسال</button></form></div>`;}
function dmSection(){const friend=state.friends.find(f=>f.user.id===state.dmId)?.user;return `<button class="btn btn-secondary" data-action="dm-back" style="margin-bottom:12px">← رجوع</button><h3>${avatar(friend)} محادثة مع ${esc(friend?.name||'لاعب')}</h3><div class="world-messages" id="dm-messages">${state.dmMessages.map(m=>messageMarkup(m,true)).join('')}</div><form class="send-row" id="dm-form"><input class="chat-input" id="dm-input" maxlength="500" placeholder="رسالتك..." required><button class="btn btn-primary" type="submit">إرسال</button></form>`;}
function renderSocial(){return `<h1 class="page-title">💬 اللمة والصحاب</h1><p class="page-sub">المحادثات والأصدقاء عبر الإنترنت محتاجين سيرفر مستقل، ومش متاحين في النسخة التجريبية.</p>
 ${state.socialMode!=='dm'?`<div class="tabs"><button data-social="friends" class="${state.socialMode==='friends'?'active':''}">👥 صحابي</button><button data-social="search" class="${state.socialMode==='search'?'active':''}">🔎 بحث</button><button data-social="world" class="${state.socialMode==='world'?'active':''}">🌍 عام</button></div>`:''}
 ${state.socialMode==='dm'?dmSection():state.socialMode==='friends'?friendsSection():state.socialMode==='search'?searchSection():worldSection()}`;}
function renderProfile(){const u=state.me,tier=Math.min(3,u.leagueTier||0),tierNames=['🥉 برونز','🥈 فضة','🥇 ذهب','💎 ماس'];return `<h1 class="page-title">👤 صفحتي</h1>
 <div class="profile-banner">${avatar(u,'large')}<h2>${esc(u.name)}</h2><small>${tierNames[tier]} · مستوى ${fmt(Math.floor(u.xp/500)+1)}</small>
 <div class="profile-id"><strong dir="ltr">${esc(u.id)}</strong><button type="button" data-action="copy-id">📋 انسخ الـID</button></div>
 <small>ده رقمك الثابت على المتصفح ده. الربط بين أجهزة مختلفة قيد التطوير.</small><div class="profile-skin">الطقم الحالي: ${esc(state.store.find(i=>i.id===u.equipped)?.name||'الكلاسيكي')}</div></div>
 <div class="stat-row" style="margin-bottom:14px"><div class="stat"><b>${fmt(u.wins)}</b><small>فوز</small></div><div class="stat"><b>${fmt(u.totalCaptures||0)}</b><small>أكل حجارة</small></div><div class="stat"><b>${fmt(u.bestCaptures||0)}</b><small>أعلى أكل بجيم</small></div></div>
 <div class="card"><div class="section-head" style="margin:0 0 9px"><h3>تعديل حسابك</h3></div><form id="profile-form"><label class="field">اسمك في اللعبة<input name="name" maxlength="24" value="${esc(u.name)}" required></label>
 <label class="gallery-picker" for="gallery-photo">📷 اختار صورتك من الجاليري <small>JPG أو PNG أو WEBP · هتتحفظ على الموبايل ده بس</small></label><input id="gallery-photo" type="file" accept="image/jpeg,image/png,image/webp" class="screen-reader-only">${u.photo?'<button type="button" class="mini-link" data-action="remove-photo">🗑️ امسح الصورة</button>':''}
 <span class="muted">أو اختار أفاتار</span><div class="avatar-options">${['🦁','👑','🐪','🦅','🐈','🪷','👸','🧑','🧕','👨','👩'].map(v=>`<button type="button" class="avatar-choice ${u.avatar===v&&!u.photo?'chosen':''}" data-action="avatar" data-value="${v}">${v}</button>`).join('')}</div>
 <div class="profile-color"><b>لون حجارتك</b><div class="tone-options">${Object.keys(tones).map(c=>colorButton(0,c,u.color||'ruby')).join('')}</div></div>
 <button class="btn btn-mint full" type="submit">حفظ التغييرات</button></form></div>
 <div class="section-head"><h3>الإعدادات</h3></div><div class="card"><div class="settings-row"><div><strong>🔊 أصوات اللعبة</strong><div class="muted">تأثيرات التحريك والمكافآت</div></div><button class="switch ${u.settings.sound!==false?'on':''}" data-action="toggle-sound" aria-label="صوت اللعبة"></button></div><div class="settings-row"><div><strong>🎵 موسيقى الخلفية</strong><div class="muted">لحن أصلي قابل للتشغيل والإيقاف</div></div><button class="switch ${u.settings.music===true?'on':''}" data-action="toggle-music" aria-label="موسيقى اللعبة"></button></div><div class="settings-row"><div><strong>🎙️ الميكروفون</strong><div class="muted">يحتاج لعبة مباشرة بين جهازين</div></div><span>غير متاح محليًا</span></div><div class="settings-row"><div><strong>🏆 الدوري الأسبوعي</strong></div><button data-action="ranking" class="mini-link">شوف مستواك</button></div><div class="settings-row"><div><strong>📏 قواعد السيجا</strong></div><button data-action="rules" class="mini-link">القواعد</button></div><button data-action="logout" class="btn btn-outline full" style="margin-top:15px">تسجيل الخروج</button></div>`;}
function renderRanking(){const u=state.me,tiers=['برونز','فضة','ذهب','ماس'],icons=['🥉','🥈','🥇','💎'],t=Math.min(3,u.leagueTier||0),season=u.season||{};
 const names={coins:'رصيد الكوينز',captures:'أكل الحجارة',friends:'بين صحابي',league:'دوري الأسبوع'};
 const metrics={coins:fmt(u.coins),captures:fmt(u.totalCaptures||0),friends:'—',league:fmt(season.points||0)};
 const nextDate=season.week?new Date(Date.parse(season.week)+7*864e5).toLocaleDateString('ar-EG',{day:'numeric',month:'long'}):'الاثنين';
 return `<button data-action="rank-back" class="btn btn-secondary" style="margin-bottom:14px">← رجوع</button><h1 class="page-title">🏆 لوحة شرف السيجا</h1>
 <div class="demo-banner">🔒 الترتيب هنا لإحصائياتك الشخصية فقط. الترتيب العالمي الحقيقي وترتيب الصحاب مش ممكنين بدون خادم مشترك وحسابات موثقة.</div>
 <div class="rank-filters">${Object.entries(names).map(([k,v])=>`<button class="${state.rankFilter===k?'active':''}" data-action="rank-filter" data-filter="${k}">${v}</button>`).join('')}</div>
 ${state.rankFilter==='friends'?`<div class="empty-state">🤝 ترتيب الصحاب هيظهر لما يتم تفعيل قاعدة بيانات مشتركة. عندك ${fmt((u.contacts||[]).length)} معرّف محفوظ محليًا.</div>`:`<div class="rank-list"><div class="list-row"><span class="rank-place">١</span>${avatar(u)}<div class="row-main"><strong>${esc(u.name)} (إنت)</strong><small>${esc(u.id)} · ترتيب محلي</small></div><span class="pill">${metrics[state.rankFilter]}</span></div></div>`}
 <div class="card league-panel"><h3>🏆 دوري الأسبوع</h3><p class="muted">ينتهي بداية يوم الاثنين ${nextDate} بتوقيت مصر • التقييم محلي وتجريبي</p><div class="tier-grid">${tiers.map((name,i)=>`<div class="tier ${i===t?'current':''}"><span>${icons[i]}</span><strong>${name}</strong></div>`).join('')}</div>
 <div class="stat-row"><div class="stat"><b>${fmt(season.points||0)}</b><small>نقاط الأسبوع</small></div><div class="stat"><b>${fmt(season.wins||0)}</b><small>فوز الأسبوع</small></div><div class="stat"><b>${fmt(season.captures||0)}</b><small>أكل الأسبوع</small></div></div>
 <p class="muted">الترقية: برونز ٢٢٠ نقطة، فضة ٤٥٠، ذهب ٧٥٠. ممكن تثبت أو تنزل لو نقاطك قليلة. مكافآت الأسبوع الافتراضية بتتصرف تلقائيًا لما تفتح اللعبة في الأسبوع الجديد.</p></div>
 ${u.history?.length?`<div class="card"><h3>📜 سجل الأسابيع</h3>${u.history.slice(0,6).map(h=>`<div class="settings-row"><span>${esc(h.week)} · ${fmt(h.points)} نقطة</span><b>${esc(h.from)} ← ${esc(h.to)} · +${fmt(h.reward)} 🪙</b></div>`).join('')}</div>`:''}`;}
function canMove(g,i,from){if(from===null)return false;if(g.board[i]!==0)return false;const n=g.size||5,r=Math.floor(i/n),c=i%n,fr=Math.floor(from/n),fc=from%n;return Math.abs(r-fr)+Math.abs(c-fc)===1;}
function currentModeLabel(){return GAME_CATALOG.find(g=>g.id===state.gameMode)?.name||'السيجا المصرية';}
function roomControls(){
 const r=state.room;if(!r)return '';
 return `<div class="room-quickbar">${r.kind==='online'?`<span class="peer-state ${r.status==='playing'?'connected':''}">${r.status==='playing'?'🟢 متصل':'🟠 بانتظار المنافس'}</span><button data-action="share-room" class="btn btn-mint">📨 ابعت الدعوة ${r.id}</button><button class="btn btn-secondary" data-action="voice">${state.voice?'🎤 اقفل المايك':'🎙️ فويس'}</button>`:''}<span class="board-3d-badge">✦ 3D</span></div>${r.kind==='online'&&r.status==='waiting'?`<div class="wait-panel">📡 الغرفة مفتوحة — ابعت لصاحبك اللينك وسيب الصفحة مفتوحة.<br><b dir="ltr">${esc(location.origin+'/room/'+r.id)}</b><br><button data-action="share-room" class="btn btn-primary">📋 نسخ الدعوة</button></div>`:''}`;
}
function floatingChat(){
 const r=state.room;if(!r)return '';
 return `<div class="chat-fab-zone"><button class="chat-fab ${state.chatOpen?'active':''}" data-action="toggle-chat" aria-controls="room-chat-drawer" aria-expanded="${state.chatOpen}" title="فتح أو قفل الشات">${state.chatOpen?'✕':'💬'}<span>${state.chatOpen?'اقفل':'الشات'}</span></button></div>
 ${state.chatOpen?`<section class="chat-drawer" id="room-chat-drawer" role="dialog" aria-label="شات الجولة"><div class="drawer-head"><strong>💬 شات الجولة</strong><button class="close-x" data-action="toggle-chat">✕</button></div><div class="world-messages" id="room-messages">${r.chat?.length?r.chat.map(m=>messageMarkup(m)).join(''):'<div class="muted">قول أهلا لمنافسك 👋</div>'}</div><form class="send-row" id="room-chat-form"><input id="room-chat-input" class="chat-input" placeholder="رسالة سريعة..." maxlength="200" required><button class="btn btn-primary">إرسال</button></form></section>`:''}`;
}
function chipVariant(p,seat,isEnemy,turn){return `<div data-seat="${seat}" class="variant-user ${isEnemy?'enemy':''} ${turn?'playing':''}"><button type="button" class="variant-avatar-btn" ${isEnemy?'data-action="open-gifts"':''}>${avatar(p,'duel-large')}</button><div><b>${esc(p?.name||'في الانتظار')}</b><small>${isEnemy?'⚔️ منافسك':'👑 إنت'} · ${tones[p?.color||'ruby']?.[1]||'🔴'}</small></div></div>`;}
function renderVariantRoom(){
 const r=state.room,g=r.game,m=g.variant,seat=r.players.findIndex(u=>u?.id===state.me.id),viewer=r.kind==='local'?g.turn:seat>=0?seat:0,enemy=1-viewer,active=r.status==='playing'&&(r.kind==='local'||g.turn===viewer);
 const moves=active?variantActions(g,g.turn):[],selected=g.chainIndex!==null?g.chainIndex:state.selected;
 const destinations=selected!==null?moves.filter(a=>a.from===selected).map(a=>a.to):[];
 const cell=(v,i)=>{const p=v?(v-1)%2:-1,tone=(r.players[p]?.color||'ruby'),isKing=v>=3;return `<button type="button" role="gridcell" data-action="cell" data-cell="${i}" class="cell ${m!=='chinese'?(Math.floor(i/8)+i%8)%2?'dark-square':'light-square':''} ${selected===i?'selected':''} ${destinations.includes(i)?'hint':''} ${g.lastMove?.to===i?'just-played':''}" aria-label="${i+1}" ${r.status!=='playing'?'disabled':''}>${v?`<span class="stone token3d tone-${esc(tone)} ${m==='chinese'?'marble':''}"><i>${isKing?'♛':''}</i></span>`:''}</button>`;};
 const board=m==='chinese'?`<div class="chinese-board" role="grid" aria-label="الداما الصينية 121 خانة">${g.board.map((v,i)=>{const a=chineseLayout[i],x=8+(a.x+6)/12*84,y=6+(a.y+6.9282032304)/13.8564064608*88;return `<button type="button" class="chinese-hole ${selected===i?'selected':''} ${destinations.includes(i)?'hint':''}" data-action="cell" data-cell="${i}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%" aria-label="الحفرة ${i+1}">${v?`<span class="stone token3d marble tone-${esc(r.players[v-1]?.color||'ruby')}"></span>`:''}</button>`;}).join('')}</div>`:`<div class="board board-checkers" role="grid" style="--board-size:8">${g.board.map(cell).join('')}</div>`;
 const finish=r.status==='finished',winner=g.winner;
 return `<div class="room-header"><button class="btn btn-secondary" data-action="leave-room">❮ خروج</button><strong>${esc(GAME_CATALOG.find(x=>x.id===m)?.name||m)}</strong><button class="btn btn-outline" data-action="rules">📜</button></div>${roomControls()}
 <div class="room-card duel-room variant-room"><div class="duel-opponent-area">${chipVariant(r.players[enemy],enemy,true,g.turn===enemy)}</div>
 ${state.giftMenuOpen?`<div class="gift-picker"><div class="gift-picker-heading"><b>🎁 اختار هدية للمنافس</b><button data-action="close-gifts" class="gift-close">✕</button></div><div class="gift-options">${(state.config?.gifts||[]).map(x=>`<button class="gift-btn" data-action="send-gift" data-gift="${x.id}"><span>${x.emoji}</span><b>${esc(x.name)}</b><small>${x.currency==='gems'?'💎':'🪙'} ${x.price}</small></button>`).join('')}</div></div>`:''}
 <div class="board-shell board3d is-tilted ${m==='chinese'?'star-shell':''}">${board}${state.captureFx&&state.captureFx.size===g.size?`<div class="capture-flash">💥 أكل ${state.captureFx.indices.length} حجر!</div>`:''}</div><div class="turn-hint">${finish?(winner==='draw'?'تعادل 🤝':winner===viewer?'🏆 كسبت الجولة!':'الخصم كسب الجولة'):(r.status==='waiting'?'ابعت الدعوة لصاحبك':active?'دورك: اختار حجر ثم مكان الحركة':'استنى دور المنافس')}</div>
 <div class="duel-self-area">${chipVariant(r.players[viewer],viewer,false,g.turn===viewer)}</div></div>
 <div class="room-actions"><button class="btn btn-secondary" data-action="toggle-music">${state.me?.settings?.music?'🎵 إيقاف الموسيقى':'🎶 موسيقى'}</button><button class="btn btn-secondary" data-action="toggle-sound">${state.me?.settings?.sound!==false?'🔊 صوت':'🔇 صامت'}</button>${finish?`<button class="btn btn-primary" data-action="${r.kind==='local'?'local':'bot'}">🎲 مباراة جديدة</button>`:''}</div>
 ${floatingChat()}`;
}
function renderRoom(){
 const r=state.room;if(!r)return '';
 if(r.game.variant)return renderVariantRoom();
 const g=r.game,n=g.size||5,center=(n*n-1)/2;
 const seat=r.players.findIndex(p=>p?.id===state.me.id);
 const viewer=r.kind==='local'?g.turn:seat>=0?seat:0,enemy=1-viewer;
 const you=r.players[viewer],foe=r.players[enemy];
 const active=(g.turn===viewer||r.kind==='local')&&r.status==='playing';
 const selected=g.chainIndex!==null&&active?g.chainIndex:state.selected;
 const legalH=active&&g.phase==='placement'?g.board.flatMap((v,i)=>v===0&&i!==center?[i]:[]):active&&selected!==null?g.board.flatMap((v,i)=>v===0&&canMove(g,i,selected)?[i]:[]):[];
 let turnText='';
 if(r.status==='waiting')turnText='مستنيين لاعب تاني يدخل بالكود';
 else if(r.status==='finished')turnText='الجولة خلصت';
 else if(active)turnText=g.phase==='placement'?`دور ${r.kind==='local'?(viewer===0?'اللاعب الأول':'اللاعب الثاني'):'ك'}: حط الحجر رقم ${g.stepInTurn+1} من ٢`:g.chainIndex!==null?'أكلت حجر! كمل حركة أكل تانية':'اختار حجر وحرّكه مربع واحد';
 else turnText='استنى المنافس يخلص دوره';
 const fx=state.captureFx&&state.captureFx.size===n?state.captureFx:null;
 const stones=(i)=>g.phase==='placement'?fmt(g.placed[i]):fmt(g.board.filter(v=>v===i+1).length);
 const playerChip=(i,opponent=false)=>{const p=r.players[i];return `<div class="duel-avatar ${opponent?'duel-avatar--opponent':'duel-avatar--self'} ${g.turn===i&&r.status==='playing'?'active-turn':''}" data-seat="${i}">
 ${opponent?`<button type="button" data-action="open-gifts" class="duel-avatar-btn" aria-label="اضغط على أفاتار ${esc(p?.name||'المنافس')} لفتح الهدايا" aria-expanded="${state.giftMenuOpen?'true':'false'}" title="اضغط لإرسال هدية">${avatar(p,'duel-large')}<span class="duel-gift-icon">🎁</span></button>`:`<div class="duel-self-avatar">${avatar(p,'duel-large')}</div>`}
 <strong class="duel-name">${esc(p?.name||'مكان فاضي')}</strong><div class="duel-score"><span>${tones[p?.color||'ruby']?.[1]||'🔴'} ${stones(i)} حجر</span><span>⚔️ ${fmt(g.capturedBy?.[i]||0)} أكل</span></div>
 ${opponent?'<span class="duel-tap-hint">👆 اضغط على الصورة وحدد هديتك</span>':'<span class="duel-self-label">إنت هنا ⬆️ منافسك قدامك</span>'}</div>`;};
 return `<div class="room-header"><button class="btn btn-secondary" data-action="leave-room">❮ خروج</button><div class="room-title">${cap(r.kind)} <span class="pill">${n}×${n}</span></div><span class="board-3d-badge">طاولة 3D</span></div>${roomControls()}
 ${r.status==='finished'?`<div class="room-result"><strong>${g.winner==='draw'?'🤝 تعادل':g.winner===0?'🎉 الأول كسب!':'🏆 الثاني كسب!'}</strong>أكلت ${fmt(g.capturedBy?.[0]||0)} حجر مقابل ${fmt(g.capturedBy?.[1]||0)}<div style="margin-top:10px">${btn('العب جولة جديدة',r.kind==='local'?'local':'bot','btn-primary')}</div></div>`:''}
 <div class="room-card duel-room">
 <div class="duel-opponent-area">${playerChip(enemy,true)}</div>
 ${state.giftMenuOpen?`<div class="gift-picker" id="gift-picker" role="group" aria-label="اختار هدية للخصم"><div class="gift-picker-heading"><b>🎁 هدية إلى ${esc(foe?.name||'المنافس')}</b><button type="button" class="gift-close" data-action="close-gifts" aria-label="إغلاق الهدايا">✕</button></div><div class="gift-options">${(state.config?.gifts||[]).map(x=>{const currency=x.currency==='gems'?'gems':'coins',symbol=currency==='gems'?'💎':'🪙';return `<button type="button" class="gift-btn" data-action="send-gift" data-gift="${esc(x.id)}" aria-label="إرسال ${esc(x.name)} مقابل ${fmt(x.price)} ${currency==='gems'?'جوهرة':'كوين'}"><span>${esc(x.emoji)}</span><b>${esc(x.name)}</b><small>${symbol} ${fmt(x.price)}</small></button>`;}).join('')}</div><p class="gift-picker-foot">رصيدك: 🪙 ${fmt(state.me.coins)} · 💎 ${fmt(state.me.gems)} — هدايا افتراضية للمتعة فقط</p></div>`:''}
 <div class="board-shell board3d is-tilted"><div class="board size-${n}" style="--board-size:${n}" role="grid" aria-label="لوحة السيجا المصرية ${n} × ${n}">${g.board.map((v,i)=>{const owner=v-1,player=r.players[owner],skin=v?player?.equipped||'classic':'',ghost=!v&&fx?.indices.includes(i),capturedOwner=ghost?1-fx.player:owner,tone=(ghost?r.players[capturedOwner]:player)?.color||(v===1?'ruby':'ocean');return `<button role="gridcell" aria-label="المربع ${i+1}${v?' محجوز':''}" class="cell ${i===center?'center':''} ${legalH.includes(i)?'hint':''} ${selected===i?'selected':''} ${g.lastMove?.to===i?'just-played':''} ${ghost?'capture-target':''}" data-action="cell" data-cell="${i}" ${r.status!=='playing'||g.winner!==null?'disabled':''}>${v?`<span class="stone token3d tone-${esc(tone)}"><i>${({gold:'✦',emerald:'✧',pharaoh:'𓂀',fire:'♨',royal:'❖'})[skin]||''}</i></span>`:ghost?`<span class="stone tone-${esc(tone)} captured-ghost">✕</span>`:''}</button>`;}).join('')}</div>
 ${fx?`<div class="capture-flash">💥 أكل ${fx.indices.length} حجر!</div>`:''}</div>
 <div class="board-caption"><span>${tones[you?.color||'ruby']?.[1]||'🔴'} حجارتك: ${stones(viewer)}</span><span>${g.phase==='placement'?'مرحلة الرصّ':'مرحلة الأكل والتحريك'}</span><span>${tones[foe?.color||'ocean']?.[1]||'🔵'} الخصم: ${stones(enemy)}</span></div>
 <div class="turn-hint">${esc(turnText)}</div>
 <div class="duel-self-area">${playerChip(viewer,false)}</div>
 <div class="seat-colors">${[viewer,enemy].map(i=>`<div class="seat-color-group"><small>${i===viewer?'لونك':'لون المنافس'}: ${tones[r.players[i]?.color||'ruby']?.[0]||''}</small><div class="tone-options">${Object.keys(tones).map(c=>colorButton(i,c,r.players[i]?.color||'ruby',i===viewer||r.kind==='local',c===r.players[1-i]?.color)).join('')}</div></div>`).join('')}</div>
 </div>
 <div class="room-actions"><button class="btn btn-secondary" data-action="rules">📜 القواعد</button><button class="btn btn-secondary" data-action="toggle-music">${state.me?.settings?.music?'🎵 إيقاف الموسيقى':'🎶 موسيقى'}</button><button class="btn btn-secondary" data-action="toggle-sound">${state.me?.settings?.sound!==false?'🔊':'🔇'}</button></div>
 ${floatingChat()}`;
}
function render(){if(!state.me)return;wallet();const main=$('#main');main.innerHTML=state.room?renderRoom():state.tab==='home'?renderHome():state.tab==='rooms'?renderRooms():state.tab==='store'?renderStore():state.tab==='social'?renderSocial():state.tab==='profile'?renderProfile():state.tab==='ranking'?renderRanking():renderHome();$('#nav').classList.toggle('hidden',!!state.room);$('#topbar').classList.toggle('hidden',!!state.room);const chats=['#world-messages','#room-messages','#dm-messages'];for(const id of chats){const el=$(id);if(el)el.scrollTop=el.scrollHeight;}if(state.room)mount3D(state.room);}
async function refresh(tab){try{if(tab==='rooms'){state.rooms=(await api('/rooms')).rooms;}if(tab==='store'){state.store=(await api('/store')).items;}if(tab==='social'){state.friends=(await api('/friends')).friends;}if(tab==='ranking'){state.ranking=(await api('/leaderboard')).users;}}catch(e){toast(e.message);}render();}
function startSocket(){if(state.socket){state.socket.disconnect();}const s=state.socket=io({transports:['websocket','polling']});s.on('connect_error',()=>toast('الشات المباشر غير متصل. حاول تحدّث الصفحة.'));
 s.on('room:update',r=>{
 if(!state.room||state.room.id!==r.id)return;
 const old=state.room.game?.moves,oldTurn=state.room.game?.turn,move=r.game.lastMove;
 state.room=r;if(r.kind==='local'&&oldTurn!==r.game.turn)state.giftMenuOpen=false;
 if(move?.kind==='move'&&move.captures?.length&&state.lastFxSeq!==move.seq){
  state.lastFxSeq=move.seq;state.captureFx={indices:move.captures,player:move.player,size:r.game.size||5};
  const capturedEffect=state.captureFx;
  setTimeout(()=>{if(state.captureFx===capturedEffect){state.captureFx=null;if(state.room?.id===r.id)render();}},1250);
 }
 if(old!==r.game.moves){effect(move?.captures?.length?'capture':move?.kind==='place'?'place':'move',state.me?.settings?.sound!==false);if(r.status==='finished')effect('victory',state.me?.settings?.sound!==false);}render();
 });
 s.on('online:status',x=>{toast(x.text||'تغيّرت حالة الاتصال');effect('join',state.me?.settings?.sound!==false);});
 s.on('gift:new',gift=>{state.giftFx=gift;state.giftMenuOpen=false;render();requestAnimationFrame(()=>animateGiftToAvatar(gift));setTimeout(()=>{if(state.giftFx===gift)state.giftFx=null;},2000);});
 s.on('lobby:update',()=>{if(!state.room&&state.tab==='rooms')refresh('rooms');});
 s.on('chat:new',m=>{if(!state.room)return;state.room.chat=[...(state.room.chat||[]),m].slice(-60);if(state.chatOpen)effect('message',state.me?.settings?.sound!==false);const el=$('#room-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('world:new',m=>{state.world.push(m);state.world=state.world.slice(-70);const el=$('#world-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('dm:new',m=>{if(state.dmId===(m.sender===state.me.id?m.receiver:m.sender)){state.dmMessages.push(m);const el=$('#dm-messages');if(el){el.innerHTML+=messageMarkup(m,true);el.scrollTop=el.scrollHeight;}}});
 s.on('wallet:update',u=>{if(u?.id===state.me.id){setMe(u);if(!state.room)render();}});
 s.on('voice:peer-joined',async({uid})=>{toast('منافسك دخل المايك');if(!state.voice||state.room?.kind!=='online'||state.room?.players[0]?.id!==state.me.id)return;try{const pc=buildPeer(uid);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await emit('voice:signal',{id:state.room.id,to:uid,data:{sdp:pc.localDescription}});}catch(e){toast('تعذّر بدء الصوت');}});
 s.on('voice:peer-left',()=>{closePeer();toast('منافسك قفل المايك');});
 s.on('voice:signal',onVoiceSignal);
 s.on('reconnect',()=>{if(state.room)subscribeRoom();});
}
function subscribeRoom(){if(!state.socket?.connected||!state.room)return;state.socket.emit('room:subscribe',{id:state.room.id},r=>{if(r?.room){state.room=r.room;render();}});}
async function enterRoom(r){state.selected=null;state.captureFx=null;state.giftMenuOpen=false;state.giftFx=null;state.lastFxSeq=null;state.room=r;state.voice=false;state.chatOpen=false;render();if(state.socket.connected)subscribeRoom();else state.socket.once('connect',subscribeRoom);window.history.replaceState({},'',`/room/${r.id}`);window.scrollTo(0,0);}
async function createRoom(kind){const data=await post(kind==='bot'?'/bot':kind==='local'?'/local':kind==='quick'?'/quick':'/rooms',{kind,size:state.boardSize,mode:state.gameMode});enterRoom(data.room);if(data.room.kind==='online')toast('ابعت كود الغرفة لصاحبك وسيب الصفحة مفتوحة');}
async function joinRoom(id){if(!id||id.length!==6)throw Error('اكتب كود الغرفة المكون من ٦ رموز');const data=await post(`/rooms/${id.toUpperCase()}/join`);enterRoom(data.room);}
async function leaveRoom(){if(!state.room)return;await voiceOff();const id=state.room.id;try{await post(`/rooms/${id}/leave`);}catch{}state.room=null;state.chatOpen=false;window.history.replaceState({},'','/');view('home');}
function shareRoom(){const r=state.room;if(!r)return;const url=`${location.origin}/room/${r.id}`;if(navigator.share){navigator.share({title:'تعالى نلعب سيجا',text:'تعالى قابلني في سيجا رويال 🎲',url}).catch(()=>{});}else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>toast('نسخت لينك الغرفة! 📋')).catch(()=>showLink(url));}else showLink(url);}
function showLink(url){openModal('لينك دعوة صاحبك',`<input class="input" readonly value="${esc(url)}" onclick="this.select()"><p class="muted">انسخ اللينك وابعته في أي شات.</p>`);}
function openModal(title,body){$('#modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><span>${esc(title)}</span><button class="close-x" data-action="close-modal">×</button></div>${body}</div></div>`;}
function closeModal(){$('#modal-root').innerHTML='';}
function showRules(){openModal('📜 قواعد السيجا المصرية',`<p class="muted">اختار ٥×٥ (١٢ حجر لكل لاعب) أو ٧×٧ (٢٤ حجر لكل لاعب).</p><div class="card" style="font-size:12px;line-height:2"><b>١. الرصّ</b><br>كل لاعب بيحط حجرين في دوره، مع ترك المربع اللي في النص فاضي لحد نهاية الرصّ.<br><b>٢. التحريك</b><br>حرّك حجر واحد مربع واحد فوق أو تحت أو يمين أو شمال. ممنوع الحركة بالقطر.<br><b>٣. الأكل</b><br>حاصر حجر الخصم بين حجرين من حجارتك في خط مستقيم. المربع اللي في النص آمن من الأكل.<br><b>٤. حركة إضافية</b><br>لو أكلت حجر، تقدر تكمل بنفس الحجر لو فيه أكل تاني.<br><b>٥. الفوز</b><br>اللي ياكل حجارة منافسه كلها يكسب. ولو اللعب قفل، الأكثر حجارة يفوز.</div><p class="footnote">دي نسخة شائعة من قواعد السيجا؛ فيه اختلافات شعبية بسيطة بين المناطق.</p>`);}
function emit(event,payload,cb){return new Promise((resolve,reject)=>{if(!state.socket?.connected)return reject(Error('الاتصال المباشر مقطوع'));state.socket.emit(event,payload,ans=>{if(ans?.error)reject(Error(ans.error));else resolve(ans||{});});});}
function activeVariantTurn(g,r,p){return r.kind==='local'||g.turn===p;}
async function doCell(i){const r=state.room,g=r?.game;if(!r||r.status!=='playing'||g.winner!==null)return;const p=r.kind==='local'?g.turn:r.players.findIndex(u=>u?.id===state.me.id);
 if(g.variant){
  if(!activeVariantTurn(g,r,p))return toast('استنى دورك');
  const acts=variantActions(g,p);
  if(g.board[i]&&((g.board[i]-1)%2)===p){if(g.chainIndex!==null&&g.chainIndex!==i)return toast('كمل بنفس الحجر');state.selected=i;effect('select',state.me?.settings?.sound!==false);return render();}
  const from=g.chainIndex!==null?g.chainIndex:state.selected;
  if(from===null||!acts.some(a=>a.from===from&&a.to===i))return toast('اختار حجر وبعده خانة صحيحة');
  try{await emit('game:action',{id:r.id,action:{kind:'move',from,to:i}});state.selected=null;}catch(e){toast(e.message);}return;
 }
 if(state.captureFx)return toast('استنى تأثير الأكل يخلص 💥');
 if(g.turn!==p)return toast('استنى دورك يا ملك');let action;
 if(g.phase==='placement'){action={kind:'place',to:i};}
 else {if(g.chainIndex!==null)state.selected=g.chainIndex;
   if(g.board[i]===p+1){if(g.chainIndex!==null&&i!==g.chainIndex)return toast('كمل بنفس الحجر اللي أكل');state.selected=i;return render();}
   if(state.selected===null)return toast('اختار حجر من حجارتك الأول');action={kind:'move',from:state.selected,to:i};}
 try{await emit('game:action',{id:r.id,action});state.selected=null;}catch(e){toast(e.message);}}
const avatars=['🦁','👑','🐪','🦅','🐈','🪷','👸','🧑','🧕','👨','👩'];
async function clickAction(b){const a=b.dataset.action,id=b.dataset.id;try{
 if(['bot','local','quick','private','public','vip'].includes(a)){await createRoom(a);return;}
 if(a==='daily'){const v=await post('/daily');setMe(v.user);sound();toast('مبروك! +٤٥٠ كوين و+١٠ جواهر 🎁');render();}
 else if(a==='join-code')await joinRoom($('#join-code')?.value.trim()||'');
 else if(a==='join')await joinRoom(id);
 else if(a==='refresh-rooms')await refresh('rooms');
 else if(a==='buy'){const v=await post('/store/buy',{id});setMe(v.user);toast('مبروك! الطقم الجديد بقى عندك');render();}
 else if(a==='equip'){const v=await post('/store/equip',{id});setMe(v.user);toast('اتغير الطقم بنجاح');render();}
 else if(a==='ranking'){state.tab='ranking';await refresh('ranking');}
 else if(a==='rank-filter'){state.rankFilter=b.dataset.filter;render();}
 else if(a==='game-mode'){const mode=b.dataset.mode;if(!GAME_CATALOG.some(g=>g.id===mode))return;state.gameMode=mode;localStorage.setItem('seega_game_mode',mode);if(mode.startsWith('seega')){state.boardSize=Number(mode.slice(5));localStorage.setItem('seega_board_size',state.boardSize);}effect('select',state.me?.settings?.sound!==false);render();}
 
 else if(a==='toggle-chat'){state.chatOpen=!state.chatOpen;effect('message',state.me?.settings?.sound!==false);render();}
 else if(a==='toggle-music'){unlockAudio();const isOn=!state.me?.settings?.music;const r=await patch('/me',{settings:{music:isOn}});setMe(r.user);if(isOn)startMusic();else stopMusic();render();}
 else if(a==='board-size'){state.boardSize=[5,7,9].includes(Number(b.dataset.size))?Number(b.dataset.size):5;state.gameMode='seega'+state.boardSize;localStorage.setItem('seega_game_mode',state.gameMode);localStorage.setItem('seega_board_size',String(state.boardSize));render();}
 else if(a==='open-gifts'){state.giftMenuOpen=!state.giftMenuOpen;render();if(state.giftMenuOpen)$('#gift-picker')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
 else if(a==='close-gifts'){state.giftMenuOpen=false;render();}
 else if(a==='send-gift'){unlockGiftAudio();state.giftMenuOpen=false;await emit('gift:send',{id:state.room?.id,gift:b.dataset.gift});toast('🎁 الهدية وصلت للخصم!');}
 else if(a==='seat-color'){
  const color=b.dataset.color,seat=Number(b.dataset.seat);
  if(state.room){if(state.room.players[1-seat]?.color===color)return toast('اللون ده اختاره الخصم؛ اختار لون مختلف');await emit('color:choose',{seat,color});if(seat===0){setMe((await api('/me')).user);}render();}
  else {const u=await patch('/me',{color});setMe(u.user);render();}
 }
 else if(a==='copy-id'){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(state.me.id);toast('اتنسخ الـID 📋');}else openModal('معرّفك',`<input class="input" readonly value="${esc(state.me.id)}" onclick="this.select()">`);}
 else if(a==='remove-photo'){const u=await patch('/me',{photo:null});setMe(u.user);render();}
 else if(a==='save-contact'){const id=$('#find-user')?.value.trim();const result=await post('/friends/request',{id});toast(result.ok?'اتحفظ الـID عندك بس، مش طلب صداقة على الإنترنت':'الـID محفوظ بالفعل');await refresh('social');}
 else if(a==='rank-back')view('home');
 else if(a==='search-user'){state.searchQuery=$('#find-user').value.trim();state.search=(await api('/users/search?q='+encodeURIComponent(state.searchQuery))).users;render();}
 else if(a==='friend-request'){const r=await post('/friends/request',{id});toast(r.ok?'بعتنا طلب الإضافة 🤝':'الطلب موجود بالفعل');}
 else if(a==='friend-accept'){const r=await post('/friends/accept',{id});if(r.ok){toast('بقيتوا صحاب 🎉');await refresh('social');}else toast('مافيش طلب صالح');}
 else if(a==='friends-refresh')await refresh('social');
 else if(a==='dm-open'){state.dmId=id;state.socialMode='dm';state.dmMessages=(await api('/dm/'+id)).messages;render();}
 else if(a==='dm-back'){state.socialMode='friends';render();}
 else if(a==='avatar'){if(!avatars.includes(b.dataset.value))return;const u=await patch('/me',{avatar:b.dataset.value});setMe(u.user);render();}
 else if(a==='toggle-sound'){unlockAudio();const u=await patch('/me',{settings:{sound:state.me.settings.sound===false}});setMe(u.user);effect('join',state.me.settings.sound!==false);render();}
 else if(a==='test-audio'){unlockAudio();effect('victory',true);startMusic();if(!state.me?.settings?.music){const u=await patch('/me',{settings:{music:true,sound:true}});setMe(u.user);}toast('🔊 الصوت والموسيقى شغالين');render();}
 else if(a==='rules')showRules();
 else if(a==='close-modal')closeModal();
 else if(a==='logout'){stopMusic();if(state.room)await leaveRoom();await voiceOff();await post('/auth/logout');state.socket?.disconnect();state.me=null;$('#auth-cover').classList.remove('hidden');view('home');}
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
document.addEventListener('change',async e=>{
 if(e.target.id!=='gallery-photo')return;
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5_000_000)return toast('اختار صورة JPG أو PNG أو WEBP أقل من ٥ ميجا');
 let url;
 try{
  url=URL.createObjectURL(file);
  const img=new Image();img.src=url;await img.decode();
  const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('المتصفح مش بيدعم تصغير الصور');
  const min=Math.min(img.naturalWidth,img.naturalHeight),x=(img.naturalWidth-min)/2,y=(img.naturalHeight-min)/2;
  ctx.drawImage(img,x,y,min,min,0,0,size,size);
  const encoded=canvas.toDataURL('image/jpeg',.78);
  if(encoded.length>170000)throw Error('الصورة كبيرة جدًا');
  const out=await patch('/me',{photo:encoded});setMe(out.user);toast('اتحفظت صورة البروفايل على جهازك 📷');render();
 }catch(err){toast('تعذر حفظ الصورة: '+err.message);}finally{if(url)URL.revokeObjectURL(url);}
});
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
async function authReady(u){setMe(u);$('#auth-cover').classList.add('hidden');startSocket();state.config=await api('/config');state.store=state.config.items;if(state.me?.settings?.music)startMusic();else stopMusic();const id=location.pathname.match(/^\/(?:room|invite)\/([A-Za-z0-9]{6})$/)?.[1];if(id){try{await joinRoom(id);}catch(e){toast(e.message);window.history.replaceState({},'','/');view('home');}}else view('home');}
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{unlockAudio();const r=await post(state.authView==='login'?'/auth/login':'/auth/register',data);await authReady(r.user);}catch(ex){toast(ex.message);}});
document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>authView(b.dataset.authView)));
$('#guest-login').addEventListener('click',async()=>{unlockAudio();try{const name=prompt('اسمك في اللعبة؟','لاعب سيجا')||'ضيف سيجا';const r=await post('/auth/guest',{name});await authReady(r.user);}catch(e){toast(e.message);}});
$('#google-login').addEventListener('click',async()=>{unlockAudio();try{const profile=await firebaseSignIn('google');const r=await post('/auth/federated',profile);await authReady(r.user);}catch(e){toast(e.message);}});
$('#facebook-login').addEventListener('click',async()=>{unlockAudio();try{const profile=await firebaseSignIn('facebook');const r=await post('/auth/federated',profile);await authReady(r.user);}catch(e){toast(e.message);}});
document.addEventListener('pointerdown',()=>{unlockAudio();if(state.me?.settings?.music)startMusic();},{capture:true,passive:true});
(async function boot(){try{state.config=await api('/config');state.store=state.config.items;const r=await api('/me');if(r.user)await authReady(r.user);else $('#auth-cover').classList.remove('hidden');if(location.search.includes('autherror'))toast('فشل الدخول الاجتماعي؛ راجع الإعدادات');}catch(e){toast('مش قادر أتصل بالسيرفر — '+e.message);}})();