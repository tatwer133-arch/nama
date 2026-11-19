import {variantActions,chineseLayout,GAME_CATALOG,initialVariant} from './variants.js';
import {initialGame} from './game-engine.js';
import {liveUid,liveOpenQuick,liveOpenPrivate,liveWallet,liveCommand,liveChat,liveWatchMatch,liveWatchInvitations,liveProfile} from './live-match.js?v=1';
import {effect,startMusic,stopMusic,isMusicOn,unlockAudio} from './soundscape.js';
import {mount3D,reset3D} from './scene3d.js?v=11.4';
import {firebaseReady,firebaseSignIn,firebaseEmail,firebaseCurrent,firebaseLogout} from './firebase-auth.js?v=11.4';
import {cloudReadOrCreate,cloudUpdate} from './cloud-profile.js?v=11.4';
import {cloudSocialAvailable,cloudSocialStart,cloudSocialStop,cloudPresence,cloudPublicProfile,cloudSearchPlayer,cloudSendFriendRequest,cloudRespondFriend,cloudSendInbox,cloudMarkInbox,cloudSendDirect,cloudWatchDirect,cloudPostPublic,cloudGetPlayer,cloudSendPublicInvite,cloudCloseDirect} from './cloud-social.js?v=11.4';
import {matchInvitesStart,matchInvitesStop,matchCreate,matchRespond,matchCancel} from './match-invites.js?v=11.4';
import {friendCallsStart,friendCallsStop,friendCallDial,friendCallAnswer,friendCallDecline,friendCallMute,friendCallHangup,friendPlayAudio} from './friend-call.js?v=11.4';
const $=sel=>document.querySelector(sel);
const fmt=n=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(n??0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={me:null,tab:'home',room:null,rooms:[],store:[],config:null,friends:[],ranking:[],search:[],world:[],socket:null,selected:null,authView:'login',socialMode:'friends',dmId:null,dmMessages:[],voice:false,localStream:null,peer:null,iceQueue:[],busy:false,boardSize:[3,5,7,9].includes(Number(localStorage.getItem('seega_board_size')))?Number(localStorage.getItem('seega_board_size')):5,gameMode:localStorage.getItem('seega_game_mode')||'seega5',boardTilt:true,chatOpen:false,rankFilter:'coins',captureFx:null,giftFx:null,giftMenuOpen:false,lastFxSeq:null,unreadRoom:0,voicePending:false,voiceConsent:false,spectatorApproved:false,cloud:{online:false,friends:[],requests:[],inbox:[],publicChat:[],dm:[]},cloudSearch:null,friendVoice:null,pendingVoice:null,matchInvites:[],outgoingInvites:[],outgoingMatchId:null,searchRequestId:0,roomVoiceMuted:false,cloudSetupIssue:null,liveMatchDoc:null,liveMatchStop:null,liveInvitesStop:null,liveProfiles:new Map()};
let toastTimer=null;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3100);}
async function api(path,options={}){const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...options});let data;try{data=await r.json();}catch{data={};}if(!r.ok)throw Error(data.error||'حصلت مشكلة في الاتصال');return data;}
const post=(path,data={})=>api(path,{method:'POST',body:JSON.stringify(data)});
const patch=async(path,data={})=>{
 const out=await api(path,{method:'PATCH',body:JSON.stringify(data)});
 if(path==='/me'&&firebaseReady()&&out.user?.firebaseUid){
  cloudUpdate(out.user).then(ok=>ok?cloudPublicProfile(out.user):null).catch(e=>toast('اتحفظ محليًا، لكن مزامنة ملفك السحابي فشلت: '+e.message));
 }
 return out;
};
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
function notifyPlayer(message,{title='سيجا رويال',vibrate=true}={}){
 toast(message);effect('message',state.me?.settings?.sound!==false);
 if(vibrate&&navigator.vibrate)navigator.vibrate([80,50,80]);
 if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){
  try{const n=new Notification(title,{body:message,icon:'/icon.svg',tag:'seega-alert'});n.onclick=()=>{window.focus();n.close();};}catch(e){console.info('Browser notification unavailable');}
 }
}
function updateSocialBadge(){
 const nav=document.querySelector('#nav [data-tab="social"]');if(!nav)return;
 const n=state.cloud?.online?Number(state.cloud.unread||0)+(state.matchInvites||[]).length+(state.cloud?.inbox||[]).filter(x=>x.kind==='invite'&&!x.read).length:0;
 let badge=nav.querySelector('.social-alert-badge');
 if(!n){badge?.remove();return;}
 if(!badge){badge=document.createElement('span');badge.className='social-alert-badge';badge.setAttribute('aria-label','تنبيهات الصحاب');nav.append(badge);}
 badge.textContent=n>99?'99+':String(n);
}
function updateFriendVoiceBar(){
 let root=document.getElementById('friend-call-banner');
 if(!root){root=document.createElement('div');root.id='friend-call-banner';document.body.append(root);}
 const call=state.friendVoice;
 if(!call?.active){root.innerHTML='';root.classList.remove('visible');return;}
 const status=call.status==='ringing'?'جاري الاتصال':call.status==='connected'?'مكالمة صوتية متصلة':'جاري توصيل الصوت';
 root.classList.add('visible');
 root.innerHTML=`<div class="friend-call-label"><b>📞 ${esc(call.name)}</b><small>${status}</small></div><div class="friend-call-buttons">
 <button data-action="friend-mute" ${call.status==='ringing'?'disabled':''} class="btn btn-secondary">${call.muted?'🎤 فتح المايك':'🔇 كتم المايك'}</button>
 <button data-action="friend-play" class="btn btn-secondary" aria-label="تشغيل صوت المكالمة">🔊</button>
 <button data-action="friend-hangup" class="btn btn-primary" aria-label="إنهاء المكالمة">📴 إنهاء</button></div>`;
}
function updateChatBadge(){const fab=$('.chat-fab');if(!fab)return;fab.classList.toggle('has-unread',state.unreadRoom>0&&!state.chatOpen);
 const badge=fab.querySelector('.chat-unread');if(badge)badge.textContent=String(Math.min(state.unreadRoom,99));}
function giftModal(){if(state.room?.watchOnly)return;
 const r=state.room,foe=r?.players.find(u=>u?.id!==state.me?.id);
 openModal('🎁 هدية للمنافس',`<div class="gift-sheet"><div class="gift-recipient">${avatar(foe)} <b>${esc(foe?.name||'المنافس')}</b></div><div class="gift-grid">${(state.config?.gifts||[]).map(x=>`<button type="button" data-action="send-gift" data-gift="${esc(x.id)}" class="gift-tile"><span>${esc(x.emoji)}</span><b>${esc(x.name)}</b><small>${x.currency==='gems'?'💎':'🪙'} ${fmt(x.price)}</small></button>`).join('')}</div><p class="gift-picker-foot">رصيدك: 🪙 ${fmt(state.me.coins)} · 💎 ${fmt(state.me.gems)}</p></div>`);
}


let giftAudioContext=null;
const giftSamples=new Map();
const allowedGiftSounds=new Set(['egg','hammer','water','cake','heart','rose']);
async function preloadGiftSample(id){
 if(!allowedGiftSounds.has(id)||giftSamples.has(id))return giftSamples.get(id);
 const pending=(async()=>{
  try{
   const response=await fetch('/audio/'+id+'.wav?v=9',{cache:'force-cache'});
   if(!response.ok)throw Error('audio not found');
   const ctx=giftAudioContext;if(!ctx)return null;
   return await ctx.decodeAudioData(await response.arrayBuffer());
  }catch(e){console.info('Using procedural fallback sound for '+id);return null;}
 })();giftSamples.set(id,pending);return pending;
}
function unlockGiftAudio(){
 if(state.me?.settings?.sound===false)return;
 try{giftAudioContext??=new (window.AudioContext||window.webkitAudioContext)();if(giftAudioContext.state==='suspended')giftAudioContext.resume().catch(()=>{});}catch{}
}
function playGiftSound(id){
 if(state.me?.settings?.sound===false)return;
 unlockGiftAudio();const ctx=giftAudioContext;if(!ctx)return;
 const cached=giftSamples.get(id);
 if(cached){
  cached.then(buffer=>{
   if(!buffer){giftSamples.delete(id);playGiftSound(id);return;}if(ctx.state!=='running')return;
   const source=ctx.createBufferSource(),gain=ctx.createGain();
   source.buffer=buffer;gain.gain.value=.85;source.connect(gain).connect(ctx.destination);source.start();
  });return;
 }
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
  case 'water':noise(.72,.23,1700);noise(.25,.1,4100,.16);tone(230,.05,.32,.045,'sine',85);break;
  case 'cake':for(const [i,n] of [392,494,587,784].entries())tone(n,i*.13,.4,.085,'sine',n*.98);noise(.1,.08,3200,.5);break;
  case 'heart':for(const [i,n] of [660,880,1046].entries())tone(n,i*.12,.48,.075,'sine',n*.99);break;
  case 'rose':tone(560,0,.38,.065);tone(840,.13,.5,.07);break;
  
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
 const projectile=document.createElement('span');projectile.className='flying-gift flying-gift--'+gift.id;projectile.textContent=gift.emoji;
 projectile.style.left=sx+'px';projectile.style.top=sy+'px';layer.append(projectile);document.body.append(layer);
 // Romantic gifts are presented beside the player, not thrown at their face.
 // Keep impact animations only for deliberately comic gifts such as egg/hammer.
 if(['rose','heart','cake'].includes(gift.id)){
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const landingX=b.left+b.width*.87;
  const landingY=b.bottom+(gift.id==='cake'?24:10);
  const gx=landingX-sx,gy=landingY-sy;
  const duration=reduced?280:gift.id==='rose'?1950:1700;
  const move=(x,y,scale,angle)=>'translate(calc(-50% + '+x+'px),calc(-50% + '+y+'px)) scale('+scale+') rotate('+angle+'deg)';
  projectile.classList.add('flying-gift--gentle');
  projectile.animate([
   {transform:move(0,0,.45,-7),opacity:0,offset:0},
   {transform:move(gx*.28,gy*.2-56,.82,5),opacity:1,offset:.28},
   {transform:move(gx*.68,gy*.65-77,1.10,-4),opacity:1,offset:.65},
   {transform:move(gx,gy,1.06,0),opacity:1,offset:.86},
   {transform:move(gx,gy-7,1.03,0),opacity:0,offset:1}
  ],{duration,fill:'forwards',easing:'cubic-bezier(.22,.66,.28,1)'});
  const announce=gift.id==='rose'?' قدّم وردة رقيقة إلى ':gift.id==='cake'?' احتفل بكيكة مع ':' بعت قلب إلى ';
  const from=state.room?.players?.[gift.from]?.name||'لاعب سيجا';
  const to=state.room?.players?.[gift.to]?.name||'صاحبه';
  setTimeout(()=>{
   playGiftSound(gift.id);
   const halo=document.createElement('span');halo.className='gift-soft-halo gift-soft-halo--'+gift.id;
   halo.textContent=gift.id==='cake'?'🍰':gift.id==='rose'?'🌹':'💖';
   halo.style.left=landingX+'px';halo.style.top=landingY+'px';layer.append(halo);
   const note=document.createElement('span');note.className='gift-announcement gift-announcement--soft';
   note.textContent=from+announce+to;
   layer.append(note);
   if(!reduced){
    const petals=gift.id==='cake'?['✨','🎊','✨','⭐']:gift.id==='rose'?['🌸','🌷','✨','🌸']:['💗','✨','💖','✨'];
    petals.forEach((emoji,i)=>{
     const p=document.createElement('span');p.className='gift-soft-petal';p.textContent=emoji;
     p.style.left=landingX+'px';p.style.top=landingY+'px';layer.append(p);
     const theta=(Math.PI*2*i/petals.length)-.7,dist=30+i*9;
     p.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},
      {opacity:1,transform:'translate(calc(-50% + '+Math.cos(theta)*dist*.65+'px),calc(-50% + '+Math.sin(theta)*dist*.65+'px)) scale(.95)',offset:.5},
      {opacity:0,transform:'translate(calc(-50% + '+Math.cos(theta)*dist+'px),calc(-50% + '+(Math.sin(theta)*dist-26)+'px)) scale(.6)'}],
      {duration:1600,easing:'ease-out',fill:'forwards'});
    });
   }
  },duration*.76);
  setTimeout(()=>layer.remove(),duration+2300);
  return;
 }
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
  const badge=document.createElement('span');badge.className='gift-impact-emoji gift-impact--'+gift.id;badge.textContent=gift.emoji;
  if(gift.id==='water'){
   const pour=document.createElement('div');pour.className='pour-water';const rect=target.getBoundingClientRect();
   pour.style.left=rect.left+rect.width*.10+'px';pour.style.top=rect.top-100+'px';pour.style.width=rect.width*.80+'px';pour.style.height=rect.height+110+'px';layer.append(pour);
   setTimeout(()=>pour.remove(),1600);
  }
  if(gift.id==='egg'){
   const yolk=document.createElement('div');yolk.className='egg-splat';const rect=target.getBoundingClientRect();
   yolk.style.left=rect.left+rect.width/2+'px';yolk.style.top=rect.top+rect.height/2+'px';layer.append(yolk);setTimeout(()=>yolk.remove(),1900);
  }
  const fromName=state.room?.players?.[gift.from]?.name||'اللاعب';
  const toName=state.room?.players?.[gift.to]?.name||'المنافس';
  const notice=document.createElement('div');notice.className='gift-announcement';notice.textContent=fromName+' حدف '+(gift.name||gift.emoji)+' على '+toName+'!';layer.append(notice);
  setTimeout(()=>notice.remove(),2550);
  const latest=target.getBoundingClientRect();badge.style.left=latest.left+latest.width/2+'px';badge.style.top=latest.top+latest.height/2+'px';layer.append(badge);
  const particles=gift.id==='water'?['💦','💧','💦','💧','🫧','💧']:
   gift.id==='egg'?['💥','🥚','✨','💥','✨','🥚']:gift.id==='cake'?['🍰','✨','🍓','✨','🍰','⭐']:
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
function view(tab){if(tab!=='social'&&state.socialMode==='dm'&&state.cloud?.online){cloudCloseDirect();state.socialMode='friends';}state.tab=tab;state.room=null;state.selected=null;$('#topbar').classList.remove('hidden');$('#nav').classList.remove('hidden');document.querySelectorAll('[data-tab]').forEach(b=>{if(b.classList.contains('nav-item'))b.classList.toggle('active',b.dataset.tab===tab);});render();window.scrollTo(0,0);}
function btn(text,action,cls='btn-primary'){return `<button class="btn ${cls}" data-action="${action}">${text}</button>`;}
function cap(k){return {local:'على نفس الجهاز',online:'أونلاين مباشر',private:'خاصة',public:'عامة',vip:'ملكية VIP',quick:'تحدّي سريع',bot:'ضد الكمبيوتر'}[k]||k;}
// V8 mobile-first home: the game starts above the fold; longer menus are dialogs.
function renderHome(){const u=state.me,mode=GAME_CATALOG.find(x=>x.id===state.gameMode)||GAME_CATALOG[0];return `<section class="home-v8">
 <div class="home-greeting">${avatar(u)}<div><small>أهلًا يا بطل</small><h2>${esc(u.name)} 👑</h2></div><button data-action="open-settings" class="round-settings" aria-label="الإعدادات">⚙️</button></div>
 <div class="home-feature"><div class="home-feature-top"><span class="crown-sub">𓂀 ARENA</span><b>سيجا رويال</b><small>بطولة الطاولة المصرية</small></div>
 <button class="chosen-game" data-action="game-picker"><span class="game-symbol">${mode.icon}</span><span><small>اللعبة المختارة</small><strong>${esc(mode.name)}</strong><em>${esc(mode.sub)}</em></span><span class="picker-chevron">⌄</span></button>
 <div class="mode-buttons-v8"><button data-action="secure-online" class="mode-primary">🌐 لعب أونلاين سريع أو خاص</button><button data-action="bot" class="mode-primary">🤖 العب ضد رمسيس</button><button data-action="private" class="mode-outline">🌐 العب مع صاحبك</button><button data-action="local" class="mode-outline">👥 نفس الموبايل</button></div></div>
 <div class="home-shortcuts"><button data-action="game-picker">🎲 اختيار اللعبة</button><button data-action="open-settings">⚙️ الإعدادات</button><button data-action="ranking">🏆 الدوري</button><button data-action="daily">🎁 هدية اليوم</button></div>
 <div class="home-bottom-stats"><span>🏆 فوز ${fmt(u.wins)}</span><span>⚔️ أكل ${fmt(u.totalCaptures||0)}</span><span>💎 ${fmt(u.gems)}</span></div>
 <p class="home-v8-foot">الأونلاين بكود دعوة تجريبي • الحساب السحابي يتطلب تفعيل Firebase</p>
 </section>`;}
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
function messageMarkup(m,isDm=false){
 const mine=[state.me.id,state.me.firebaseUid].includes(m.uid||m.sender);
 if(m.kind==='gift')return `<div class="msg gift-chat-bubble ${mine?'me':''}" aria-label="هدية مرسلة"><span class="gift-chat-emoji" aria-label="${esc(m.giftName||'هدية')}">${esc(m.emoji||'🎁')}</span></div>`;
 const uid=m.uid||m.sender,isPublic=!isDm&&state.cloud?.online&&state.socialMode==='world';
 const user={name:m.name||(mine?state.me.name:'لاعب'),avatar:m.avatar||(mine?state.me.avatar:'💬'),photo:m.photo||(mine?state.me.photo:null)};
 const person=isPublic&&!mine?`<button type="button" class="chat-person" data-action="cloud-profile" data-uid="${esc(uid)}" title="عرض بروفايل اللاعب">${avatar(user)}<b>${esc(user.name)}</b></button>`
 :`<span class="chat-person">${avatar(user)}<b>${esc(user.name)}</b></span>`;
 return `<div class="msg ${mine?'me':''}"><div class="msg-person">${person}${isPublic?`<small class="chat-presence ${m.online?'yes':''}">${m.online?'🟢 متصل':'⚫ غير متصل'}</small>`:''}</div><div class="msg-box"><span>${esc(m.text||m.body||'')}</span>${isPublic&&!mine&&m.online?`<button class="chat-challenge" data-action="cloud-challenge" data-uid="${esc(uid)}">🎲 تحداه</button>`:''}</div></div>`;
}
function worldSection(){return `<div class="card"><div class="section-head" style="margin:0 0 10px"><h3>🌍 الشات العام</h3><span><i class="neon-dot"></i> مباشر</span></div><div class="world-messages" id="world-messages">${state.world.length?state.world.map(m=>messageMarkup(m)).join(''):'<div class="muted">ابدأ أنت السلام على الناس 👋</div>'}</div><form class="send-row" id="world-form"><input class="chat-input" id="world-input" maxlength="150" placeholder="اكتب رسالة لطيفة..." required><button class="btn btn-primary" type="submit">إرسال</button></form></div>`;}
function dmSection(){const friend=state.friends.find(f=>f.user.id===state.dmId)?.user;return `<button class="btn btn-secondary" data-action="dm-back" style="margin-bottom:12px">← رجوع</button><h3>${avatar(friend)} محادثة مع ${esc(friend?.name||'لاعب')}</h3><div class="world-messages" id="dm-messages">${state.dmMessages.map(m=>messageMarkup(m,true)).join('')}</div><form class="send-row" id="dm-form"><input class="chat-input" id="dm-input" maxlength="500" placeholder="رسالتك..." required><button class="btn btn-primary" type="submit">إرسال</button></form>`;}
function cloudSearchRows(results){
 if(!Array.isArray(results))return '';
 if(!results.length)return '<div class="empty-state">مفيش لاعبين بنفس الحروف. جرّب تكمل الاسم.</div>';
 return `<div class="friend-list">${results.map(p=>{
  const relation=(state.cloud?.friends||[]).some(f=>f.uid===p.uid)?'friend':
  (state.cloud?.requests||[]).some(r=>r.fromUid===p.uid)?'incoming':
  (state.cloud?.sentRequests||[]).some(r=>r.toUid===p.uid)?'sent':p.relation;
  const button=relation==='friend'?'<span class="pill">✓ عندك في الأصدقاء</span>':
    relation==='sent'?'<span class="pill">📨 الطلب اتبعت</span>':
    relation==='incoming'?'<span class="pill">📬 بعت لك طلب</span>':
    `<button class="btn btn-primary" data-action="cloud-add" data-uid="${esc(p.uid)}">إضافة</button>`;
  return `<div class="list-row"><button class="friend-person" data-action="cloud-profile" data-uid="${esc(p.uid)}">${avatar(p.user)}<span><b>${esc(p.user.name)}</b><small>${esc(p.user.id)}</small></span></button>${button}</div>`;
 }).join('')}</div>`;
}
let searchDelay=null;
async function cloudSearchIncremental(value){
 const req=++state.searchRequestId;state.searchQuery=String(value||'').trim();
 const host=$('#cloud-search-results');
 if(state.searchQuery.length<2){state.cloudSearch=null;if(host)host.innerHTML='';return;}
 if(host)host.innerHTML='<p class="muted">🔎 جاري البحث...</p>';
 try{
  const result=await cloudSearchPlayer(state.searchQuery);
  if(req!==state.searchRequestId||state.socialMode!=='search')return;
  state.cloudSearch=result;
  const panel=$('#cloud-search-results');if(panel)panel.innerHTML=cloudSearchRows(result);
 }catch(e){
  if(req!==state.searchRequestId)return;
  const panel=$('#cloud-search-results');if(panel)panel.innerHTML=`<p class="muted" role="status">${esc(e.message)}</p>`;
 }
}
function matchInviteRows(){
 const requests=(state.matchInvites||[]).filter(x=>x.status==='pending');
 const legacy=(state.cloud?.inbox||[]).filter(x=>x.kind==='invite'&&!x.read&&/^[A-Z0-9]{6}$/.test(x.roomCode||''));
 if(!requests.length&&!legacy.length)return '';
 return `<div class="card match-requests"><h3>🎲 دعوات المباريات (${requests.length+legacy.length})</h3>
 ${requests.map(r=>`<div class="list-row"><div class="row-main"><b>${esc(r.fromName||'لاعب سيجا')} بعت لك تحدّي</b><small>الغرفة: ${esc(r.roomCode)}</small></div>
 <button class="btn btn-mint" data-action="match-accept" data-id="${esc(r.id)}" data-code="${esc(r.roomCode)}">✅ موافقة</button>
 <button class="btn btn-secondary" data-action="match-reject" data-id="${esc(r.id)}">رفض</button></div>`).join('')}
 ${legacy.map(r=>`<div class="list-row"><div class="row-main"><b>${esc(r.text||'دعوة مباراة')}</b><small>الغرفة: ${esc(r.roomCode)}</small></div>
 <button class="btn btn-mint" data-action="accept-invite" data-notice="${esc(r.id)}" data-code="${esc(r.roomCode)}">✅ موافقة</button>
 <button class="btn btn-secondary" data-action="decline-invite" data-notice="${esc(r.id)}">رفض</button></div>`).join('')}
 </div>`;
}
function renderCloudSocial(){
 const cloud=state.cloud||{},friends=cloud.friends||[],requests=cloud.requests||[],chat=cloud.publicChat||[];
 const tabs=state.socialMode==='dm'?'':`<div class="tabs"><button data-social="friends" class="${state.socialMode==='friends'?'active':''}">👥 صحابي</button><button data-social="search" class="${state.socialMode==='search'?'active':''}">🔎 إضافة</button><button data-social="world" class="${state.socialMode==='world'?'active':''}">🌍 الشات العام</button></div>`;
 if(state.socialMode==='search'){
  return tabs+`<div class="card"><h3>🔎 دور على لاعب بالاسم أو الإيميل أو Player ID</h3>
   <div class="join-box"><input id="find-user" class="input" placeholder="اكتب أول حرفين من اسم صاحبك" autocomplete="off" value="${esc(state.searchQuery||'')}"><button class="btn btn-mint" data-action="cloud-search">بحث</button></div>
   <div id="cloud-search-results" aria-live="polite">${cloudSearchRows(state.cloudSearch)}</div>
   <p class="muted">الأسماء المقترحة بتظهر تلقائيًا بعد كتابة حرفين.</p></div>`;
 }
 if(state.socialMode==='world')return tabs+`<div class="card"><h3>🌍 الشات العام · لاعبين حقيقيين</h3>
 <div class="world-messages" id="world-messages">${chat.map(m=>`${messageMarkup(m)}${m.roomCode?`<button class="invite-chat-action" data-action="join" data-id="${esc(m.roomCode)}">🎲 انضم للغرفة ${esc(m.roomCode)}</button>`:''}`).join('')||'<p class="muted">قول أهلا للناس 👋</p>'}</div>
 <form id="world-form" class="send-row"><input id="world-input" class="chat-input" maxlength="180" placeholder="رسالة لكل المسجلين" required><button class="btn btn-primary">إرسال</button></form></div>`;
 if(state.socialMode==='dm'){
  const friend=friends.find(f=>f.uid===state.cloud?.dmOther);
  return `<button class="btn btn-secondary" data-action="cloud-dm-back">← الصحاب</button>
  <div class="card"><div class="dm-header"><button class="friend-person" data-action="cloud-profile" data-uid="${esc(friend?.uid||'')}">${avatar(friend?.user)}<span><b>${esc(friend?.user?.name||'صاحبك')}</b><small>${friend?.online?'🟢 متصل':'⚫ غير متصل'}</small></span></button>
  ${friend?.online?`<button class="btn btn-secondary" data-action="friend-call" data-uid="${esc(friend.uid)}" aria-label="اتصل بصديقك">📞 اتصال</button>`:''}</div>
  <div class="world-messages" id="dm-messages">${(cloud.dm||[]).map(m=>messageMarkup(m,true)).join('')||'<p class="muted">ابدأ المحادثة</p>'}</div>
  <form id="dm-form" class="send-row"><input id="dm-input" class="chat-input" maxlength="200" placeholder="اكتب لصاحبك" required><button class="btn btn-primary">إرسال</button></form></div>`;
 }
 return tabs+`${matchInviteRows()}${requests.length?`<div class="card"><h3>📨 طلبات الصداقة (${requests.length})</h3>${requests.map(r=>`<div class="list-row">${avatar(r.user)}<div class="row-main"><b>${esc(r.user?.name)}</b><small>${esc(r.user?.id)}</small></div><button data-action="cloud-accept" data-pair="${esc(r.pairId)}" class="btn btn-mint">قبول</button><button data-action="cloud-reject" data-pair="${esc(r.pairId)}" class="btn btn-secondary">رفض</button></div>`).join('')}</div>`:''}
 <div class="friend-list">${friends.length?friends.map(f=>{
  const unread=(cloud.inbox||[]).filter(x=>x.fromUid===f.uid&&!x.read&&x.kind==='dm').length;
  return `<div class="list-row cloud-friend"><button class="friend-person" data-action="cloud-profile" data-uid="${esc(f.uid)}" aria-label="بروفايل ${esc(f.user.name)}">${avatar(f.user)}<span><b>${esc(f.user.name)}</b><small><span class="presence-circle ${f.online?'online':''}"></span> ${f.online?(f.status==='playing'?'بيلعب الآن':f.status==='watching'?'بيتفرج':'متصل'):'غير متصل'} · ${esc(f.user.id)}</small></span></button><div class="friend-actions">
  <button data-action="cloud-dm" data-uid="${esc(f.uid)}" aria-label="شات خاص" title="شات خاص">💬${unread?`<span class="mini-count">${unread}</span>`:''}</button>
  ${f.online?`<button data-action="friend-call" data-uid="${esc(f.uid)}" aria-label="اتصال صوتي" title="اتصل بصديقك">📞</button><button data-action="cloud-challenge" data-uid="${esc(f.uid)}" title="تحداه الآن" aria-label="تحداه الآن">🎲</button>`:''}
  ${f.watchAllowed&&f.roomCode?`<button data-action="watch-room" data-code="${esc(f.roomCode)}" title="شاهد المباراة">👀</button>`:''}
  </div></div>`;
 }).join(''):`<div class="empty-state">🤝 لسه ما عندكش أصدقاء. اضغط «إضافة» وابحث بالاسم أو الإيميل أو الـID.</div>`}</div>`;
}

async function showCloudPlayer(uid){
 const p=await cloudGetPlayer(uid);
 const friend=(state.cloud?.friends||[]).some(x=>x.uid===uid);
 const sent=(state.cloud?.sentRequests||[]).some(x=>x.toUid===uid);
 const incoming=(state.cloud?.requests||[]).some(x=>x.fromUid===uid);
 const display=`<div class="profile-banner">${avatar(p.user,'large')}<h2>${esc(p.user.name)}</h2><small>${p.online?'🟢 متصل':'⚫ غير متصل'} · ${esc(p.user.id)}</small></div>`;
 const actions=uid===state.me?.firebaseUid?'':
 `<div class="cloud-player-actions">${friend?`<button class="btn btn-secondary" data-action="cloud-dm" data-uid="${esc(uid)}">💬 شات خاص</button>`:
 sent?'<span class="pill">📨 طلب الصداقة مُرسل</span>':
 incoming?'<span class="pill">📬 عندك طلب صداقة منه</span>':
 `<button class="btn btn-secondary" data-action="cloud-add" data-uid="${esc(uid)}">➕ إضافة صديق</button>`}
 ${p.online?`<button class="btn btn-primary" data-action="cloud-challenge" data-uid="${esc(uid)}">🎲 تحدّاه</button>`:''}
 ${friend&&p.online?`<button class="btn btn-secondary" data-action="friend-call" data-uid="${esc(uid)}">📞 اتصال صوتي</button>`:''}</div>`;
 openModal('👤 بروفايل اللاعب',display+actions);
}
async function challengeCloudPlayer(uid){
 if(state.room)throw Error('اخرج من الماتش الحالي قبل دعوة لاعب جديد');
 const person=await cloudGetPlayer(uid);
 if(!person.online)throw Error('اللاعب غير متصل حاليًا');
 const friend=(state.cloud?.friends||[]).some(f=>f.uid===uid);
 closeModal();
 await createRoom('private');
 if(!state.room||state.room.kind!=='online')throw Error('الغرفة لم تبدأ');
 try{
  state.outgoingMatchId=await matchCreate(uid,state.room.id,playerName());
  render();toast('🎲 بعت طلب تحدي لـ '+person.user.name+' — مستنيين الموافقة');
 }catch(error){
  // Preserve old friend invitation transport if new Firebase rules are not
  // published yet. Public invites require the secure rules on the server.
  if(friend&&/Firestore|permissions|الصلاحيات|permission/i.test(error.message)){
   try{await cloudSendInbox(uid,'invite','🎲 '+playerName()+' بعت لك تحدّي في السيجا',state.room.id);
    toast('📨 الدعوة اتبعتت؛ لازم صاحبك يوافق من قائمة الأصدقاء');return;
   }catch{}
  }
  await leaveRoom();
  throw error;
 }
}
function renderSocial(){return `<h1 class="page-title">💬 اللمة والصحاب</h1>${state.cloudSetupIssue?`<div class="cloud-setup-hint" role="status"><span>☁️ بعض خدمات Firebase تحتاج إعدادًا</span><button data-action="cloud-info" aria-label="تفاصيل إعداد Firebase">تفاصيل</button></div>`:''}${state.cloud?.online?renderCloudSocial():`<div class="demo-banner">☁️ الحسابات والأصدقاء والشات بين الأجهزة محتاجين تفعيل Firebase للمشروع. حسابات الضيف والإيميل المحلي مش متصلة بالشبكة.</div><div class="tabs"><button data-social="friends" class="${state.socialMode==='friends'?'active':''}">👥 معرّفات محفوظة</button><button data-social="search" class="${state.socialMode==='search'?'active':''}">🔎 حفظ ID</button></div>${state.socialMode==='search'?searchSection():friendsSection()}`}`;}
function renderProfile(){const u=state.me,tier=Math.min(3,u.leagueTier||0),tierNames=['🥉 برونز','🥈 فضة','🥇 ذهب','💎 ماس'];return `<h1 class="page-title">👤 صفحتي</h1>
 <div class="profile-banner">${avatar(u,'large')}<h2>${esc(u.name)}</h2><small>${tierNames[tier]} · مستوى ${fmt(Math.floor(u.xp/500)+1)}</small>
 <div class="profile-id"><strong dir="ltr">${esc(u.id)}</strong><button type="button" data-action="copy-id">📋 انسخ الـID</button></div>
 <small>${state.cloud?.online?'☁️ حساب متزامن عبر Firebase':'الـID محلي لحد ما يتم ربط Firebase وتسجيل حساب حقيقي.'}</small><div class="profile-skin">الطقم الحالي: ${esc(state.store.find(i=>i.id===u.equipped)?.name||'الكلاسيكي')}</div></div>
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
 if(r.protocol==='server'){
  const doc=state.liveMatchDoc,me=doc?.players?.find(p=>p?.uid===state.me?.firebaseUid),hasRival=Boolean(doc?.players?.[1]);
  const canReady=r.status==='waiting'&&hasRival;
  const host=doc?.ownerUid===state.me?.firebaseUid;
  const seconds=r.deadline?Math.max(0,Math.ceil((r.deadline-Date.now())/1000)):null;
  return `<div class="room-quickbar"><span class="peer-state ${r.status==='playing'?'connected':''}">☁️ مباراة على الخادم · ${esc(r.status)}</span><span class="pill">🪙 رهان: ${fmt((r.stakeMinor||0)/100)}</span>${canReady?`<button class="btn btn-mint" data-action="safe-ready">${me?.ready?'✅ جاهز — إلغاء':'✅ أنا جاهز'}</button>`:''}${host&&r.status==='waiting'&&doc.type==='private'?`<button class="btn btn-secondary" data-action="safe-invite">➕ دعوة صديق</button>${hasRival?'<button class="btn btn-secondary" data-action="safe-kick">🚫 طرد المنافس</button>':''}`:''}${seconds!==null&&r.status==='playing'?`<span class="pill" id="live-countdown">⏱️ ${seconds} ثانية</span>`:''}<button class="btn btn-secondary" data-action="safe-leave">خروج</button></div>${r.status==='waiting'?`<div class="wait-panel">${hasRival?'في انتظار Ready من اللاعبين':'مستني لاعب حقيقي بنفس نوع السيجا والرهان'}</div>`:''}`;
 }
 return `<div class="room-quickbar">${r.watchOnly?`<span class="peer-state connected">👀 مشاهدة فقط · ${(r.viewers||[]).length} مشاهد</span><span class="pill">ممنوع التحريك والفويس</span>`:r.kind==='online'?`<span class="peer-state ${r.status==='playing'?'connected':''}">${r.status==='playing'?'🟢 متصل':'🟠 بانتظار المنافس'}</span><button data-action="share-room" class="btn btn-mint">📨 ادعُ لاعب ${r.id}</button><button class="btn btn-secondary" data-action="voice">${state.voice?'📴 إنهاء المكالمة':state.voicePending?'⌛ طلب المايك':'📞 اتصال صوتي'}</button>${state.voice?`<button class="btn btn-secondary" data-action="room-voice-mute" aria-pressed="${state.roomVoiceMuted}" aria-label="${state.roomVoiceMuted?'فتح الميكروفون':'كتم الميكروفون'}">${state.roomVoiceMuted?'🔇 مكتوم — فتح':'🎙️ كتم المايك'}</button>`:''}${r.owner===state.me.id?`<button class="btn btn-secondary" data-action="toggle-spectators" title="السماح للمشاهدين">${r.allowSpectators?'👀 اقفل المشاهدة':'👁️ افتح المشاهدة'}</button>`:''}${r.allowSpectators?`<button class="btn btn-secondary" data-action="share-watch">🔗 لينك المشاهدة</button>`:''}<button class="btn btn-secondary" data-action="quick-social" title="الأصدقاء والشات العام">👥 الأصدقاء</button>`:''}<span class="board-3d-badge">✦ 3D</span></div>${r.kind==='online'&&r.status==='waiting'?`<div class="wait-panel">📡 الغرفة مفتوحة — ابعت لصاحبك اللينك وسيب الصفحة مفتوحة.<br><b dir="ltr">${esc(location.origin+'/room/'+r.id)}</b><br><button data-action="share-room" class="btn btn-primary">📋 نسخ الدعوة</button></div>`:''}`;
}
function floatingChat(){
 const r=state.room;if(!r)return '';
 return `<div class="chat-fab-zone"><button class="chat-fab ${state.chatOpen?'active':''}" data-action="toggle-chat" aria-controls="room-chat-drawer" aria-expanded="${state.chatOpen}" title="فتح أو قفل الشات">${state.chatOpen?'✕':'💬'}<span>${state.chatOpen?'اقفل':'الشات'}</span><b class="chat-unread" ${state.unreadRoom===0||state.chatOpen?'hidden':''}>${Math.min(state.unreadRoom,99)}</b></button></div>
 ${state.chatOpen?`<section class="chat-drawer" id="room-chat-drawer" role="dialog" aria-label="شات الجولة"><div class="drawer-head"><strong>💬 شات الجولة</strong><button class="close-x" data-action="toggle-chat">✕</button></div><div class="world-messages" id="room-messages">${r.chat?.length?r.chat.map(m=>messageMarkup(m)).join(''):'<div class="muted">قول أهلا لمنافسك 👋</div>'}</div><form class="send-row" id="room-chat-form"><input id="room-chat-input" class="chat-input" placeholder="رسالة سريعة..." maxlength="200" required><button class="btn btn-primary">إرسال</button></form></section>`:''}`;
}
function chipVariant(p,seat,isEnemy,turn){return `<div data-seat="${seat}" class="variant-user ${isEnemy?'enemy':''} ${turn?'playing':''}"><button type="button" class="variant-avatar-btn" ${isEnemy&&!state.room?.watchOnly?'data-action="open-gifts"':''}>${avatar(p,'duel-large')}</button><div><b>${esc(p?.name||'في الانتظار')}</b><small>${isEnemy?'⚔️ منافسك':'👑 إنت'} · ${tones[p?.color||'ruby']?.[1]||'🔴'}</small></div></div>`;}
function renderVariantRoom(){
 const r=state.room,g=r.game,m=g.variant,seat=r.players.findIndex(u=>u?.id===state.me.id),viewer=r.kind==='local'?g.turn:seat>=0?seat:0,enemy=1-viewer,active=!r.watchOnly&&r.status==='playing'&&(r.kind==='local'||g.turn===viewer);
 const moves=active?variantActions(g,g.turn):[],selected=g.chainIndex!==null?g.chainIndex:state.selected;
 const destinations=g.phase==='placement'?[]:selected!==null?moves.filter(a=>a.from===selected).map(a=>a.to):[];
 const boardN=m==='seega3'?3:8;
 const cell=(v,i)=>{const p=v?(v-1)%2:-1,tone=(r.players[p]?.color||'ruby'),isKing=v>=3;return `<button type="button" role="gridcell" data-action="cell" data-cell="${i}" class="cell ${m!=='chinese'?(Math.floor(i/boardN)+i%boardN)%2?'dark-square':'light-square':''} ${selected===i?'selected':''} ${destinations.includes(i)?'hint':''} ${g.lastMove?.to===i?'just-played':''}" aria-label="${i+1}" ${r.watchOnly||r.status!=='playing'?'disabled':''}>${v?`<span class="stone token3d tone-${esc(tone)} ${m==='chinese'?'marble':''}"><i>${isKing?'♛':''}</i></span>`:''}</button>`;};
 const board=m==='chinese'?`<div class="chinese-board" role="grid" aria-label="الداما الصينية 121 خانة">${g.board.map((v,i)=>{const a=chineseLayout[i],x=8+(a.x+6)/12*84,y=6+(a.y+6.9282032304)/13.8564064608*88;return `<button type="button" class="chinese-hole ${selected===i?'selected':''} ${destinations.includes(i)?'hint':''}" data-action="cell" data-cell="${i}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%" aria-label="الحفرة ${i+1}">${v?`<span class="stone token3d marble tone-${esc(r.players[v-1]?.color||'ruby')}"></span>`:''}</button>`;}).join('')}</div>`:`<div class="board board-checkers" role="grid" style="--board-size:${boardN}">${g.board.map(cell).join('')}</div>`;
 const finish=r.status==='finished',winner=g.winner;
 return `<div class="room-header"><button class="btn btn-secondary" data-action="leave-room">❮ خروج</button><strong>${esc(GAME_CATALOG.find(x=>x.id===m)?.name||m)}</strong><button class="btn btn-outline" data-action="open-settings">⚙️</button></div>${roomControls()}
 <div class="room-card duel-room variant-room"><div class="duel-opponent-area">${chipVariant(r.players[enemy],enemy,true,g.turn===enemy)}</div>${r.watchOnly?`<div class="viewer-strip">👀 مشاهدة ${esc(r.players[0]?.name)} ضد ${esc(r.players[1]?.name)} · شات فقط</div>`:r.viewers?.length?`<div class="viewer-strip">👀 ${r.viewers.map(v=>avatar(v,'viewer-mini')+esc(v.name)).join(' · ')}</div>`:''}

 <div class="board-shell board3d is-tilted ${m==='chinese'?'star-shell':''}" data-phase="${g.phase||'movement'}">${board}${state.captureFx&&state.captureFx.size===g.size?`<div class="capture-flash">💥 أكل ${state.captureFx.indices.length} حجر!</div>`:''}</div><div class="turn-hint">${finish?(winner==='draw'?'تعادل 🤝':winner===viewer?'🏆 كسبت الجولة!':'الخصم كسب الجولة'):(r.status==='waiting'?'ابعت الدعوة لصاحبك':active?(g.phase==='placement'?'دورك: حط حجر من الثلاثة':'دورك: اختار حجر ثم مكان الحركة'):'استنى دور المنافس')}</div>
 <div class="duel-self-area">${chipVariant(r.players[viewer],viewer,false,g.turn===viewer)}</div></div>
 <div class="room-actions"><button class="btn btn-secondary" data-action="open-settings">⚙️ إعدادات الصوت</button>${finish?`<button class="btn btn-primary" data-action="${r.kind==='local'?'local':'bot'}">🎲 مباراة جديدة</button>`:''}</div>
 ${floatingChat()}`;
}
function renderRoom(){
 const r=state.room;if(!r)return '';
 if(r.game.variant)return renderVariantRoom();
 const g=r.game,n=g.size||5,center=(n*n-1)/2;
 const seat=r.players.findIndex(p=>p?.id===state.me.id);
 const viewer=r.kind==='local'?g.turn:seat>=0?seat:0,enemy=1-viewer;
 const you=r.players[viewer],foe=r.players[enemy];
 const active=!r.watchOnly&&(g.turn===viewer||r.kind==='local')&&r.status==='playing';
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
 ${opponent&&!r.watchOnly?`<button type="button" data-action="open-gifts" class="duel-avatar-btn" aria-label="اضغط على أفاتار ${esc(p?.name||'المنافس')} لفتح الهدايا" aria-expanded="${state.giftMenuOpen?'true':'false'}" title="اضغط لإرسال هدية">${avatar(p,'duel-large')}<span class="duel-gift-icon">🎁</span></button>`:`<div class="duel-self-avatar">${avatar(p,'duel-large')}</div>`}
 <strong class="duel-name">${esc(p?.name||'مكان فاضي')}</strong><div class="duel-score"><span>${tones[p?.color||'ruby']?.[1]||'🔴'} ${stones(i)} حجر</span><span>⚔️ ${fmt(g.capturedBy?.[i]||0)} أكل</span></div>
 ${opponent?'<span class="duel-tap-hint">👆 اضغط على الصورة وحدد هديتك</span>':'<span class="duel-self-label">إنت هنا ⬆️ منافسك قدامك</span>'}</div>`;};
 return `<div class="room-header"><button class="btn btn-secondary" data-action="leave-room">❮ خروج</button><div class="room-title">${cap(r.kind)} <span class="pill">${n}×${n}</span></div><button data-action="open-settings" class="btn btn-secondary">⚙️</button></div>${roomControls()}
 ${r.status==='finished'?`<div class="room-result"><strong>${g.winner==='draw'?'🤝 تعادل':g.winner===0?'🎉 الأول كسب!':'🏆 الثاني كسب!'}</strong>أكلت ${fmt(g.capturedBy?.[0]||0)} حجر مقابل ${fmt(g.capturedBy?.[1]||0)}<div style="margin-top:10px">${btn('العب جولة جديدة',r.kind==='local'?'local':'bot','btn-primary')}</div></div>`:''}
 <div class="room-card duel-room">
 <div class="duel-opponent-area">${playerChip(enemy,true)}</div>${r.watchOnly?`<div class="viewer-strip">👀 بتتفرج على ${esc(r.players[0]?.name)} ضد ${esc(r.players[1]?.name)} · ${(r.viewers||[]).length} مشاهد · الشات فقط</div>`:r.viewers?.length?`<div class="viewer-strip">👀 المشاهدون: ${r.viewers.map(v=>avatar(v,'viewer-mini')+esc(v.name)).join(' · ')}</div>`:''}

 <div class="board-shell board3d is-tilted" data-phase="${g.phase||'movement'}"><div class="board size-${n}" style="--board-size:${n}" role="grid" aria-label="لوحة السيجا المصرية ${n} × ${n}">${g.board.map((v,i)=>{const owner=v-1,player=r.players[owner],skin=v?player?.equipped||'classic':'',ghost=!v&&fx?.indices.includes(i),capturedOwner=ghost?1-fx.player:owner,tone=(ghost?r.players[capturedOwner]:player)?.color||(v===1?'ruby':'ocean');return `<button role="gridcell" aria-label="المربع ${i+1}${v?' محجوز':''}" class="cell ${i===center?'center':''} ${legalH.includes(i)?'hint':''} ${selected===i?'selected':''} ${g.lastMove?.to===i?'just-played':''} ${ghost?'capture-target':''}" data-action="cell" data-cell="${i}" ${r.watchOnly||r.status!=='playing'||g.winner!==null?'disabled':''}>${v?`<span class="stone token3d tone-${esc(tone)}"><i>${({gold:'✦',emerald:'✧',pharaoh:'𓂀',fire:'♨',royal:'❖'})[skin]||''}</i></span>`:ghost?`<span class="stone tone-${esc(tone)} captured-ghost">✕</span>`:''}</button>`;}).join('')}</div>
 ${fx?`<div class="capture-flash">💥 أكل ${fx.indices.length} حجر!</div>`:''}</div>
 <div class="board-caption"><span>${tones[you?.color||'ruby']?.[1]||'🔴'} حجارتك: ${stones(viewer)}</span><span>${g.phase==='placement'?'مرحلة الرصّ':'مرحلة الأكل والتحريك'}</span><span>${tones[foe?.color||'ocean']?.[1]||'🔵'} الخصم: ${stones(enemy)}</span></div>
 <div class="turn-hint">${esc(turnText)}</div>
 <div class="duel-self-area">${playerChip(viewer,false)}</div>
 <div class="seat-colors">${[viewer,enemy].map(i=>`<div class="seat-color-group"><small>${i===viewer?'لونك':'لون المنافس'}: ${tones[r.players[i]?.color||'ruby']?.[0]||''}</small><div class="tone-options">${Object.keys(tones).map(c=>colorButton(i,c,r.players[i]?.color||'ruby',i===viewer||r.kind==='local',c===r.players[1-i]?.color)).join('')}</div></div>`).join('')}</div>
 </div>
 <div class="room-actions"><button class="btn btn-secondary" data-action="rules">📜 القواعد</button><button class="btn btn-secondary" data-action="toggle-music">${state.me?.settings?.music?'🎵 إيقاف الموسيقى':'🎶 موسيقى'}</button><button class="btn btn-secondary" data-action="toggle-sound">${state.me?.settings?.sound!==false?'🔊':'🔇'}</button></div>
 ${floatingChat()}`;
}
function render(){if(!state.me)return;wallet();if(!state.room)reset3D();const main=$('#main');main.innerHTML=state.room?renderRoom():state.tab==='home'?renderHome():state.tab==='rooms'?renderRooms():state.tab==='store'?renderStore():state.tab==='social'?renderSocial():state.tab==='profile'?renderProfile():state.tab==='ranking'?renderRanking():renderHome();$('#nav').classList.toggle('hidden',!!state.room);$('#topbar').classList.toggle('hidden',!!state.room);const chats=['#world-messages','#room-messages','#dm-messages'];for(const id of chats){const el=$(id);if(el)el.scrollTop=el.scrollHeight;}if(state.room)mount3D(state.room);updateChatBadge();updateSocialBadge();updateFriendVoiceBar();}
async function refresh(tab){try{if(tab==='rooms'){state.rooms=(await api('/rooms')).rooms;}if(tab==='store'){state.store=(await api('/store')).items;}if(tab==='social'&&!state.cloud?.online){state.friends=(await api('/friends')).friends;}if(tab==='ranking'){state.ranking=(await api('/leaderboard')).users;}}catch(e){toast(e.message);}render();}
function startSocket(){if(state.socket){state.socket.disconnect();}const s=state.socket=io({transports:['websocket','polling']});s.on('connect_error',()=>toast('الشات المباشر غير متصل. حاول تحدّث الصفحة.'));
 s.on('room:update',r=>{
 if(!state.room||state.room.id!==r.id)return;
 const old=state.room.game?.moves,oldTurn=state.room.game?.turn,move=r.game.lastMove;
 const permissionChanged=state.room.allowSpectators!==r.allowSpectators||state.room.status!==r.status;state.room=r;if(permissionChanged)cloudPresence().catch(()=>{});if(r.kind==='local'&&oldTurn!==r.game.turn)state.giftMenuOpen=false;
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
 s.on('chat:new',m=>{if(!state.room)return;state.room.chat=[...(state.room.chat||[]),m].slice(-60);if(m.uid!==state.me.id&&m.kind!=='gift'){if(!state.chatOpen){state.unreadRoom++;notifyPlayer('💬 رسالة من '+(m.name||'المنافس')+(m.viewer?' (مشاهد)':''));}else effect('message',state.me?.settings?.sound!==false);}updateChatBadge();const el=$('#room-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('world:new',m=>{state.world.push(m);state.world=state.world.slice(-70);const el=$('#world-messages');if(el){el.innerHTML+=messageMarkup(m);el.scrollTop=el.scrollHeight;}});
 s.on('dm:new',m=>{if(state.dmId===(m.sender===state.me.id?m.receiver:m.sender)){state.dmMessages.push(m);const el=$('#dm-messages');if(el){el.innerHTML+=messageMarkup(m,true);el.scrollTop=el.scrollHeight;}}});
 s.on('wallet:update',u=>{if(u?.id===state.me.id){setMe(u);if(!state.room)render();}});
 s.on('voice:peer-joined',async({uid})=>{toast('منافسك دخل المايك');if(!state.voice||state.room?.kind!=='online'||state.room?.players[0]?.id!==state.me.id)return;try{const pc=buildPeer(uid);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await emit('voice:signal',{id:state.room.id,to:uid,data:{sdp:pc.localDescription}});}catch(e){toast('تعذّر بدء الصوت');}});
 s.on('voice:peer-left',()=>{voiceOff().catch(()=>{});toast('منافسك قفل المكالمة');render();});
 s.on('voice:signal',onVoiceSignal);
 s.on('voice:incoming',({from})=>{state.voicePending=false;openModal('📞 اتصال صوتي من '+(from||'المنافس'),'<div class="call-request"><p>منافسك بيطلب يفتح المايك معاك. تقبل المكالمة؟</p><div class="call-buttons"><button class="btn btn-mint" data-action="accept-call">✅ موافقة</button><button class="btn btn-secondary" data-action="reject-call">❌ رفض</button></div></div>');notifyPlayer('📞 '+(from||'المنافس')+' عايز يكلمك');});
 s.on('voice:accepted',async()=>{if(!state.voicePending)return;closeModal();state.voicePending=false;try{await startVoiceSession();toast('🎤 المنافس وافق على المكالمة');render();}catch(e){toast(e.message);render();}});
 s.on('voice:rejected',()=>{state.voicePending=false;closeModal();notifyPlayer('❌ المنافس رفض المكالمة');});
 s.on('voice:cancelled',()=>{closeModal();toast('📞 المنافس ألغى طلب المكالمة');});
 s.on('spectator:request',()=>{openModal('👀 طلب مشاهدة المباراة','<p>صاحب الغرفة عايز يفتح المشاهدة. تسمح للناس يشوفوا اللوحة والشات ويسمعوا الصوت لو المايك شغال؟</p><div class="call-buttons"><button class="btn btn-mint" data-action="spectator-approve">✅ موافق</button><button class="btn btn-secondary" data-action="spectator-deny">❌ رفض</button></div>');});
 s.on('spectator:joined',()=>{if(state.voice&&state.localStream)window.seegaSpectatorMedia?.broadcast(state.localStream);});
 s.on('spectator:audio',({peerId,stream})=>{if(!state.room?.watchOnly)return;let audio=document.querySelector(`[data-spectator-audio="${peerId}"]`);if(!audio){audio=document.createElement('audio');audio.dataset.spectatorAudio=peerId;audio.autoplay=true;audio.playsInline=true;document.body.append(audio);}audio.srcObject=stream;audio.play().catch(()=>toast('اضغط الشاشة لتشغيل صوت المباراة'));});
 s.on('reconnect',()=>{if(state.room)subscribeRoom();});
}
function subscribeRoom(){if(!state.socket?.connected||!state.room)return;state.socket.emit('room:subscribe',{id:state.room.id},r=>{if(r?.room){state.room=r.room;render();}});}
async function enterRoom(r){state.selected=null;state.captureFx=null;state.giftMenuOpen=false;state.giftFx=null;state.lastFxSeq=null;state.room=r;state.voice=false;state.roomVoiceMuted=false;state.voicePending=false;state.chatOpen=false;state.unreadRoom=0;render();cloudPresence().catch(()=>{});if(r.protocol!=='server'){if(state.socket.connected)subscribeRoom();else state.socket.once('connect',subscribeRoom);}window.history.replaceState({},'',`${r.watchOnly?'/watch/':'/room/'}${r.id}`);window.scrollTo(0,0);}

function liveRoomView(m){
 const game=m.game||(m.mode==='seega3'?initialVariant('seega3'):m.mode.startsWith('seega')?initialGame(Number(m.mode.slice(5))):initialVariant(m.mode));
 const players=m.players.map((p,i)=>{
  if(!p)return{id:'waiting',name:'في انتظار لاعب',avatar:'⏳',color:i?'ocean':'ruby'};
  if(p.uid===state.me?.firebaseUid)return{...state.me,uid:p.uid};
  const pub=state.liveProfiles.get(p.uid)||{};
  return{uid:p.uid,id:pub.id||'cloud:'+p.uid,name:pub.name||'لاعب حقيقي',avatar:pub.avatar||'🎮',
   photo:pub.photo||null,color:i?'ocean':'ruby'};
 });
 return{id:m.id,protocol:'server',kind:'online',type:m.type,mode:m.mode,status:m.status,owner:m.ownerUid===state.me?.firebaseUid?state.me?.id:'cloud-host',
  players,game,chat:state.room?.id===m.id?state.room.chat||[]:[],count:m.players.filter(Boolean).length,
  stakeMinor:m.stakeMinor||0,deadline:m.deadline,version:m.version};
}
async function liveRefreshPlayers(match){
 for(const p of match.players.filter(Boolean)){
  if(p.uid===state.me?.firebaseUid||state.liveProfiles.has(p.uid))continue;
  try{
   const profile=await liveProfile(p.uid);
   state.liveProfiles.set(p.uid,profile||{});
   if(state.liveMatchDoc?.id===match.id&&state.room?.protocol==='server'){
    state.room=liveRoomView(state.liveMatchDoc);render();
   }
  }catch(e){console.info('Match player directory not ready',e);}
 }
}
async function enterLiveRoom(match){
 if(state.room&&state.room.id!==match.id)throw Error('اخرج من المباراة الحالية أولًا');
 try{state.liveMatchStop?.();}catch{}
 state.liveMatchStop=null;state.liveMatchDoc=match;
 await enterRoom(liveRoomView(match));
 const handlers={
  onMatch(next){
   if(state.room?.id!==match.id||state.room.protocol!=='server')return;
   state.liveMatchDoc=next;state.room=liveRoomView(next);render();
   liveRefreshPlayers(next).catch(()=>{});
  },
  onChat(items){
   if(state.room?.id!==match.id||state.room.protocol!=='server')return;
   state.room.chat=items.map(item=>({...item,
    uid:item.uid===state.me?.firebaseUid?state.me.id:item.uid,
    name:item.uid===state.me?.firebaseUid?playerName():(state.liveProfiles.get(item.uid)?.name||'المنافس')
   }));if(state.chatOpen)render();
  },
  onError(error){if(state.room?.id===match.id)toast('خادم المباراة: '+(error?.message||'انقطع الاتصال'));}
 };
 state.liveMatchStop=await liveWatchMatch(match.id,handlers);
 await liveRefreshPlayers(match);
}
async function safeOnlinePicker(){
 const cloud=await firebaseCurrent();
 if(!cloud?.uid)throw Error('لازم تسجل دخول بحساب Firebase حقيقي علشان تلعب أونلاين');
 const walletStatus=await liveWallet();
 const funds=walletStatus?.balanceMinor;
 const stakeValues=[0,500,1000,2500,5000,10000,25000];
 const options=stakeValues.map(stake=>{
  const disabled=stake>0&&(!Number.isSafeInteger(funds)||stake>funds);
  const amount=new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(stake/100);
  return `<button class="btn ${disabled?'btn-secondary':'btn-primary'}" data-action="safe-quick" data-stake="${stake}" ${disabled?'disabled':''}>⚡ لعب سريع · ${stake===0?'مجاني':amount+' 🪙'}</button>`;
 }).join('');
 openModal('🌐 لعب أونلاين على الخادم',`<p class="muted">المطابقة مع لاعب حقيقي بنفس نوع اللعبة والرهان. المباراة لن تبدأ إلا بعد Ready من الطرفين.</p>
 <div class="mode-buttons-v8">${options}</div>
 <hr><button class="btn btn-mint full" data-action="safe-private">🔒 غرفة خاصة ودعوة صديق (مجاني)</button>
 <p class="muted">${Number.isSafeInteger(funds)?'رصيد الرهان السحابي: '+new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(funds/100)+' 🪙':'الرصيد المحلي لم يُنقل للخادم بعد؛ اللعب المجاني فقط متاح.'} الرصيد المحلي القديم محفوظ من غير تعديل.</p>`);
}
function safeInvitePicker(){
 const friends=(state.cloud?.friends||[]).slice().sort((a,b)=>Number(b.online)-Number(a.online));
 if(!friends.length)throw Error('أضف صديقًا حقيقيًا من تبويب الأصدقاء الأول');
 openModal('👥 اختار صديق للمباراة',`<div class="room-list">${friends.map(f=>`<button class="list-row" data-action="safe-invite-friend" data-uid="${esc(f.uid)}">${avatar(f.user)}<span>${esc(f.user?.name||'صديق')} · ${f.online?'🟢 متصل':'⚪ غير متصل'}</span><span>دعوة ➕</span></button>`).join('')}</div>`);
}

async function createRoom(kind){const data=await post(kind==='bot'?'/bot':kind==='local'?'/local':kind==='quick'?'/quick':'/rooms',{kind,size:state.boardSize,mode:state.gameMode});enterRoom(data.room);if(data.room.kind==='online')toast('ابعت كود الغرفة لصاحبك وسيب الصفحة مفتوحة');}
async function joinRoom(id){if(!id||id.length!==6)throw Error('اكتب كود الغرفة المكون من ٦ رموز');const data=await post(`/rooms/${id.toUpperCase()}/join`);enterRoom(data.room);}
async function joinInvitedRoom(code,button){
 const original=button?.textContent||'موافقة';
 if(button){button.disabled=true;button.textContent='⌛ جاري توصيل المباراة...';button.setAttribute('aria-busy','true');}
 try{
  if(state.room?.kind==='online')throw Error('اخرج من الماتش الحالي قبل قبول دعوة جديدة');
  await joinRoom(code);
  return true;
 }catch(e){
  const reason=e?.message||'الاتصال تعطل';
  openModal('لم نقدر ندخل المباراة',`<p>❌ ${esc(reason)}</p><p class="muted">خلي صاحب الدعوة يسيب الغرفة مفتوحة. لو الإنترنت فصل، اطلب منه يبعت دعوة جديدة أو جرّب تدخل بكود الغرفة.</p><button class="btn btn-secondary full" data-action="close-modal">تمام</button>`);
  return false;
 }finally{
  if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=original;}
 }
}

async function watchRoom(id){if(!id||id.length!==6)throw Error('كود الغرفة غير صحيح');const data=await post(`/rooms/${id.toUpperCase()}/watch`);enterRoom(data.room);}
function shareWatch(){const r=state.room;if(!r?.allowSpectators)return toast('المشاهدة مقفولة');const link=location.origin+'/watch/'+r.id;
 if(navigator.share)navigator.share({title:'اتفرج على ماتش السيجا',url:link}).catch(()=>showLink(link));else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>toast('اتنسخ لينك المشاهدة 📋')).catch(()=>showLink(link));else showLink(link);
}
async function leaveRoom(){if(!state.room)return;
 if(state.room.protocol==='server'){
  const r=state.room;if(r.status!=='finished'&&r.status!=='cancelled')await liveCommand(r.id,'leave');
  try{state.liveMatchStop?.();}catch{}state.liveMatchStop=null;state.liveMatchDoc=null;
  state.room=null;state.chatOpen=false;state.unreadRoom=0;window.history.replaceState({},'','/');view('home');return;
 }
 await voiceOff();const id=state.room.id;
 if(state.outgoingMatchId){await matchCancel(state.outgoingMatchId);state.outgoingMatchId=null;}
 try{await post(`/rooms/${id}/leave`);}catch{}state.room=null;state.chatOpen=false;state.unreadRoom=0;document.querySelectorAll('[data-spectator-audio]').forEach(x=>x.remove());window.history.replaceState({},'','/');cloudPresence().catch(()=>{});view('home');}
function shareRoom(){const r=state.room;if(!r)return;const url=`${location.origin}/room/${r.id}`;if(navigator.share){navigator.share({title:'تعالى نلعب سيجا',text:'تعالى قابلني في سيجا رويال 🎲',url}).catch(()=>{});}else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>toast('نسخت لينك الغرفة! 📋')).catch(()=>showLink(url));}else showLink(url);}
function showLink(url){openModal('لينك دعوة صاحبك',`<input class="input" readonly value="${esc(url)}" onclick="this.select()"><p class="muted">انسخ اللينك وابعته في أي شات.</p>`);}
function openModal(title,body){$('#modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><span>${esc(title)}</span><button class="close-x" data-action="close-modal">×</button></div>${body}</div></div>`;}
function closeModal(){$('#modal-root').innerHTML='';}

function showSocialDialog(tab='friends'){
 if(!state.cloud?.online)return openModal('👥 الأصدقاء والشات','<div class="demo-banner">لازم تسجيل حساب Firebase حقيقي علشان الشات العام والدعوات بين الأجهزة تشتغل.</div>');
 state.quickSocial=tab;
 const friends=state.cloud.friends||[];
 const html=tab==='friends'?`<div class="friend-list">${friends.map(f=>`<div class="list-row">${avatar(f.user)}<div class="row-main"><b>${esc(f.user.name)}</b><small>${f.online?'🟢':'⚫'} ${f.status==='playing'?'بيلعب':'صاحبك'}</small></div><div class="friend-actions"><button data-action="cloud-invite" data-uid="${esc(f.uid)}" title="ابعت دعوة">🎲</button>${f.watchAllowed&&f.roomCode?`<button data-action="watch-room" data-code="${esc(f.roomCode)}">👀</button>`:''}</div></div>`).join('')||'<p class="muted">مفيش أصحاب، أضفهم بالـID أو الإيميل من قائمة الصحاب.</p>'}</div>`:
 `<div class="world-messages" id="world-messages">${(state.cloud.publicChat||[]).map(m=>`${messageMarkup(m)}${m.roomCode?`<button class="invite-chat-action" data-action="join" data-id="${esc(m.roomCode)}">🎲 أدخل الغرفة</button>`:''}`).join('')}</div><form class="send-row" id="world-form"><input class="chat-input" id="world-input" maxlength="180" placeholder="اكتب للشات العام" required><button class="btn btn-mint">إرسال</button></form>${state.room?.kind==='online'&&!state.room?.watchOnly?'<button class="btn btn-secondary full" data-action="publish-room">📢 انشر لينك غرفتك هنا</button>':''}`;
 openModal('👥 اللمة الأونلاين',`<div class="tabs"><button data-action="quick-friends" class="${tab==='friends'?'active':''}">👥 الصحاب</button><button data-action="quick-world" class="${tab==='world'?'active':''}">🌍 الشات العام</button></div>${html}`);
}
function showGamePicker(){openModal('🎲 اختار نوع اللعبة',`<div class="game-select-modal">${GAME_CATALOG.map(x=>`<button data-action="game-mode" data-mode="${x.id}" class="game-select-row ${state.gameMode===x.id?'chosen':''}"><span>${x.icon}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.sub)}</small></div><i>${state.gameMode===x.id?'✓':'›'}</i></button>`).join('')}</div>`);}
function showSettings(){const settings=state.me?.settings||{};openModal('⚙️ إعدادات اللعبة',`<div class="settings-popup"><div class="settings-row"><div><b>🔊 المؤثرات الصوتية</b><small>خطوات الحجارة والهدايا والفوز</small></div><button data-action="toggle-sound" class="switch ${settings.sound!==false?'on':''}" aria-label="تفعيل صوت اللعبة"></button></div><div class="settings-row"><div><b>🎵 موسيقى الخلفية</b><small>موسيقى أصلية قابلة للكتم</small></div><button data-action="toggle-music" class="switch ${settings.music===true?'on':''}" aria-label="تفعيل الموسيقى"></button></div>${state.room?.kind==='online'&&state.room.owner===state.me?.id?`<div class="settings-row"><div><b>👀 السماح بالمشاهدة</b><small>المشاهدة تفتح فقط بموافقة المنافس، ويظهر اسم كل مشاهد.</small></div><button data-action="toggle-spectators" class="switch ${state.room.allowSpectators?'on':''}" aria-label="تفعيل المشاهدة"></button></div>`:''}<div class="settings-row"><div><b>🔔 تنبيهات الرسائل والمكالمات</b><small>تنبيه داخل اللعبة، وإشعار المتصفح بإذن منك</small></div><button class="btn btn-secondary" data-action="enable-notifications">فعّل</button></div><button class="btn btn-mint full" data-action="test-audio">🔊 اختبار الصوت والموسيقى</button><p class="muted" style="font-size:11px;text-align:center">في متصفح الموبايل لازم تضغط مرة لتفعيل الصوت.</p></div>`);}

function showRules(){
 if(state.room?.game?.variant==='seega3'||state.gameMode==='seega3'){
  openModal('📜 السيجا الصغيرة ٣×٣','<p>كل لاعب بيحط ٣ حجارة بالتبادل على الطاولة. أول لاعب يعمل ٣ حجارة في صف أفقي أو رأسي أو قطري يكسب. لو مفيش صف بعد الرص، انقل أي حجر لخانة فاضية في دورك.</p>');return;
 }
 if(state.room?.game?.variant==='chinese'||state.gameMode==='chinese'){
  openModal('📜 الداما الصينية','<p>انقل الكرة لخانة مجاورة فاضية أو اقفز فوق كرات تانية إلى خانة فاضية. ممكن تعمل سلسلة قفزات في نفس النقلة. الهدف إن الكرات العشرة توصل لمثلث الخصم المقابل.</p>');return;
 }
 if(['american','russian'].includes(state.room?.game?.variant||state.gameMode)){
  openModal('📜 الداما','<p>حرّك الحجارة قطريًا على المربعات الغامقة. اقفز فوق حجر المنافس لأكله. نوع اللعبة المختار بيحدد قواعد الملك والأكل للخلف.</p>');return;
 }
 openModal('📜 قواعد السيجا المصرية',`<p class="muted">اختار ٥×٥ (١٢ حجر لكل لاعب) أو ٧×٧ (٢٤ حجر لكل لاعب).</p><div class="card" style="font-size:12px;line-height:2"><b>١. الرصّ</b><br>كل لاعب بيحط حجرين في دوره، مع ترك المربع اللي في النص فاضي لحد نهاية الرصّ.<br><b>٢. التحريك</b><br>حرّك حجر واحد مربع واحد فوق أو تحت أو يمين أو شمال. ممنوع الحركة بالقطر.<br><b>٣. الأكل</b><br>حاصر حجر الخصم بين حجرين من حجارتك في خط مستقيم. المربع اللي في النص آمن من الأكل.<br><b>٤. حركة إضافية</b><br>لو أكلت حجر، تقدر تكمل بنفس الحجر لو فيه أكل تاني.<br><b>٥. الفوز</b><br>اللي ياكل حجارة منافسه كلها يكسب. ولو اللعب قفل، الأكثر حجارة يفوز.</div><p class="footnote">دي نسخة شائعة من قواعد السيجا؛ فيه اختلافات شعبية بسيطة بين المناطق.</p>`);}
function emit(event,payload,cb){if(state.room?.protocol==='server'){
  if(event==='game:action')return liveCommand(state.room.id,'move',{action:payload.action});
  if(event==='chat:send')return liveChat(state.room.id,payload.text);
  return Promise.reject(Error('الميزة غير مفعّلة بعد في النسخة الآمنة'));
 }return new Promise((resolve,reject)=>{if(!state.socket?.connected)return reject(Error('الاتصال المباشر مقطوع'));state.socket.emit(event,payload,ans=>{if(ans?.error)reject(Error(ans.error));else resolve(ans||{});});});}
function activeVariantTurn(g,r,p){return r.kind==='local'||g.turn===p;}
async function doCell(i){const r=state.room,g=r?.game;if(!r||r.watchOnly||r.status!=='playing'||g.winner!==null)return;const p=r.kind==='local'?g.turn:r.players.findIndex(u=>u?.id===state.me.id);
 if(g.variant){
  if(!activeVariantTurn(g,r,p))return toast('استنى دورك');
  const acts=variantActions(g,p);
  if(g.variant==='seega3'&&g.phase==='placement'){
   if(!acts.some(a=>a.to===i))return toast('الخانة دي مش فاضية');
   await emit('game:action',{id:r.id,action:{kind:'place',to:i}});state.selected=null;return;
  }
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
 else if(a==='game-mode'){const mode=b.dataset.mode;if(!GAME_CATALOG.some(g=>g.id===mode))return;state.gameMode=mode;localStorage.setItem('seega_game_mode',mode);if(mode.startsWith('seega')){state.boardSize=Number(mode.slice(5));localStorage.setItem('seega_board_size',state.boardSize);}closeModal();effect('select',state.me?.settings?.sound!==false);render();}
 
 else if(a==='game-picker')showGamePicker();
 else if(a==='open-settings')showSettings();
 else if(a==='toggle-chat'){state.chatOpen=!state.chatOpen;if(state.chatOpen)state.unreadRoom=0;effect('message',state.me?.settings?.sound!==false);render();}
 else if(a==='toggle-music'){unlockAudio();const isOn=!state.me?.settings?.music;const r=await patch('/me',{settings:{music:isOn}});setMe(r.user);if(isOn)startMusic();else stopMusic();render();if($('#modal-root .settings-popup'))showSettings();}
 else if(a==='board-size'){state.boardSize=[3,5,7,9].includes(Number(b.dataset.size))?Number(b.dataset.size):5;state.gameMode='seega'+state.boardSize;localStorage.setItem('seega_game_mode',state.gameMode);localStorage.setItem('seega_board_size',String(state.boardSize));render();}
 else if(a==='open-gifts'){giftModal();}
 else if(a==='close-gifts'){state.giftMenuOpen=false;render();}
 else if(a==='send-gift'){unlockGiftAudio();preloadGiftSample(b.dataset.gift);closeModal();await emit('gift:send',{id:state.room?.id,gift:b.dataset.gift});toast('🎁 الهدية وصلت للخصم!');}
 else if(a==='seat-color'){
  const color=b.dataset.color,seat=Number(b.dataset.seat);
  if(state.room){if(state.room.players[1-seat]?.color===color)return toast('اللون ده اختاره الخصم؛ اختار لون مختلف');await emit('color:choose',{seat,color});if(seat===0){setMe((await api('/me')).user);if(firebaseReady())cloudUpdate(state.me).catch(()=>{});}render();}
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
 else if(a==='toggle-sound'){unlockAudio();const u=await patch('/me',{settings:{sound:state.me.settings.sound===false}});setMe(u.user);effect('join',state.me.settings.sound!==false);render();if($('#modal-root .settings-popup'))showSettings();}
 else if(a==='test-audio'){unlockAudio();effect('victory',true);startMusic();if(!state.me?.settings?.music){const u=await patch('/me',{settings:{music:true,sound:true}});setMe(u.user);}toast('🔊 الصوت والموسيقى شغالين');render();if($('#modal-root .settings-popup'))showSettings();}
 else if(a==='rules')showRules();
 else if(a==='close-modal')closeModal();
 else if(a==='cloud-info'){openModal('إعداد خدمات Firebase',`<p>${esc(state.cloudSetupIssue||'تحتاج بعض الخدمات لتفعيل قواعد Firestore.')}</p><p class="muted">اللعب كضيف وباقي خصائص اللعبة متاحة. لإصلاح الصلاحيات افتح قواعد Firestore وانشر نسخة الملف الموجودة في GitHub.</p><button data-action="close-modal" class="btn btn-secondary full">تمام</button>`);}
 else if(a==='logout'){stopMusic();if(state.room)await leaveRoom();await voiceOff();await friendCallsStop().catch(()=>{});await matchInvitesStop().catch(()=>{});await post('/auth/logout');if(firebaseReady()){await cloudSocialStop().catch(()=>{});await firebaseLogout().catch(()=>{});}state.socket?.disconnect();state.me=null;state.cloud={online:false,friends:[],requests:[],publicChat:[],inbox:[],dm:[],unread:0};state.matchInvites=[];state.outgoingInvites=[];state.outgoingMatchId=null;$('#auth-cover').classList.remove('hidden');updateSocialBadge();updateFriendVoiceBar();view('home');}
 else if(a==='cell')await doCell(Number(b.dataset.cell));
 else if(a==='share-room')shareRoom();
 else if(a==='share-watch')shareWatch();
 else if(a==='quick-social')showSocialDialog('friends');
 else if(a==='quick-friends')showSocialDialog('friends');
 else if(a==='quick-world')showSocialDialog('world');
 else if(a==='watch-room')await watchRoom(b.dataset.code);
 else if(a==='accept-invite'){
  if(state.busy)return;
  state.busy=true;try{
   const ok=await joinInvitedRoom(b.dataset.code,b);
   if(!ok)return;
   if(b.dataset.notice)await cloudMarkInbox(b.dataset.notice).catch(()=>{});
   closeModal();toast('🎲 دخلت غرفة التحدي');
  }finally{state.busy=false;}
 }
 else if(a==='decline-invite'){if(b.dataset.notice)await cloudMarkInbox(b.dataset.notice);closeModal();toast('رفضت الدعوة');}
 else if(a==='match-accept'){
  if(state.busy)return;
  const id=b.dataset.id,code=b.dataset.code;state.busy=true;try{
   // Enter only after peer-to-peer handshaking actually succeeds.
   const ok=await joinInvitedRoom(code,b);
   if(!ok)return;
   await matchRespond(id,true).catch(e=>toast('دخلت المباراة، لكن تأكيد الموافقة فشل: '+e.message));
   closeModal();toast('✅ بدأ التحدي');
  }finally{state.busy=false;}
 }
 else if(a==='match-reject'){await matchRespond(b.dataset.id,false);closeModal();toast('تم رفض التحدي');}
 else if(a==='toggle-spectators'){const allow=!state.room?.allowSpectators;const out=await emit('spectator:toggle',{allow});toast(out.pending?'👀 مستنيين موافقة المنافس':allow?'المشاهدة اتفتحت':'المشاهدة اتقفلت');}
 else if(a==='spectator-approve'){await emit('spectator:response',{accept:true});closeModal();toast('المشاهدة اتفتحت للمباراة');}
 else if(a==='spectator-deny'){await emit('spectator:response',{accept:false});closeModal();toast('رفضت المشاهدة');}
 else if(a==='accept-call'){closeModal();await emit('voice:response',{accept:true});try{await startVoiceSession();render();}catch(e){toast(e.message);await emit('voice:leave',{id:state.room?.id}).catch(()=>{});render();}}
 else if(a==='reject-call'){closeModal();await emit('voice:response',{accept:false});toast('رفضت المكالمة');}
 else if(a==='cancel-call'){state.voicePending=false;await emit('voice:cancel',{id:state.room?.id});closeModal();toast('اتلغى الطلب');}
 else if(a==='enable-notifications'){if(!('Notification' in window))return toast('المتصفح لا يدعم إشعارات النظام');const permission=await Notification.requestPermission();toast(permission==='granted'?'🔔 تم تفعيل إشعارات المتصفح':'هنظهر التنبيهات داخل اللعبة فقط');}
 else if(a==='cloud-search'){await cloudSearchIncremental($('#find-user')?.value);}
 else if(a==='cloud-add'){await cloudSendFriendRequest(b.dataset.uid);if(Array.isArray(state.cloudSearch))state.cloudSearch=state.cloudSearch.map(p=>p.uid===b.dataset.uid?{...p,relation:'sent'}:p);closeModal();toast('📨 بعت طلب الصداقة');render();}
 else if(a==='cloud-accept'||a==='cloud-reject'){await cloudRespondFriend(b.dataset.pair,a==='cloud-accept');toast(a==='cloud-accept'?'🤝 وافقت على الصداقة':'رفضت الطلب');}
 else if(a==='cloud-dm'){closeModal();state.tab='social';state.socialMode='dm';state.cloud.dmOther=b.dataset.uid;cloudWatchDirect(b.dataset.uid);render();}
 else if(a==='cloud-dm-back'){cloudCloseDirect();state.socialMode='friends';render();}
 else if(a==='cloud-profile'){await showCloudPlayer(b.dataset.uid);}
 else if(a==='cloud-challenge'){await challengeCloudPlayer(b.dataset.uid);}
 else if(a==='friend-call'){
  const friend=(state.cloud?.friends||[]).find(f=>f.uid===b.dataset.uid);
  if(!friend?.online)throw Error('صاحبك غير متصل حاليًا');
  closeModal();
  // In a live match, use the established room voice handshake. Both players
  // consent and each gets an independent mute control.
  if(state.room?.kind==='online'){
   if(state.room.status!=='playing')throw Error('اتصال الماتش يبدأ لما صاحبك يدخل الغرفة');
   await requestVoice();return;
  }
  await friendCallDial(friend.uid,friend.user.name);
  toast('📞 جاري الاتصال بـ '+friend.user.name);
 }
 else if(a==='friend-call-accept'){
  const pending=state.pendingVoice;state.pendingVoice=null;closeModal();
  if(!pending)throw Error('المكالمة انتهت');
  const friend=(state.cloud?.friends||[]).find(f=>f.uid===pending.uid);
  await friendCallAnswer(pending.id,friend?.user?.name||'صديقك');
 }
 else if(a==='friend-call-decline'){if(state.pendingVoice)await friendCallDecline(state.pendingVoice.id);state.pendingVoice=null;closeModal();}
 else if(a==='friend-hangup'){await friendCallHangup();toast('📴 انتهت المكالمة');}
 else if(a==='friend-mute'){const muted=friendCallMute();toast(muted?'🔇 المايك مكتوم':'🎤 المايك مفتوح');}
 else if(a==='friend-play'){await friendPlayAudio()?.catch(()=>toast('اسمح بتشغيل الصوت من المتصفح'));}
 else if(a==='cloud-invite'){if(!state.room||state.room.kind!=='online')return toast('اعمل غرفة أونلاين الأول');await cloudSendInbox(b.dataset.uid,'invite',playerName()+' بعت لك دعوة لمباراة سيجا',state.room.id);toast('📨 الدعوة اتبعتت');}
 else if(a==='publish-room'){if(!state.room||state.room.kind!=='online')return;await cloudPostPublic('🎲 ادخل نافسني في سيجا رويال',state.room.id);toast('📢 الدعوة ظهرت في الشات العام');}
 else if(a==='leave-room')await leaveRoom();
 else if(a==='room-voice-mute'){
  if(!state.voice||!state.localStream)return toast('ابدأ المكالمة الأول');
  state.roomVoiceMuted=!state.roomVoiceMuted;
  for(const t of state.localStream.getAudioTracks())t.enabled=!state.roomVoiceMuted;
  toast(state.roomVoiceMuted?'🔇 المايك اتكتم عندك فقط':'🎤 المايك مفتوح عندك');render();
 }
 else if(a==='voice'){if(state.voice)await voiceOff();else await requestVoice();render();}
 }catch(e){toast(e.message);}}
async function onForm(form){try{if(form.id==='profile-form'){const v=await patch('/me',{name:new FormData(form).get('name')});setMe(v.user);toast('اتحفظت التغييرات');render();}
 else if(form.id==='room-chat-form'){const input=$('#room-chat-input'),text=input.value.trim();if(!text)return;await emit('chat:send',{id:state.room.id,text});input.value='';}
 else if(form.id==='world-form'){const input=$('#world-input'),text=input.value.trim();if(!text)return;if(state.cloud?.online)await cloudPostPublic(text);else await emit('world:send',{text});input.value='';}
 else if(form.id==='dm-form'){const input=$('#dm-input'),text=input.value.trim();if(!text)return;if(state.cloud?.online)await cloudSendDirect(state.cloud.dmOther,text);else await emit('dm:send',{to:state.dmId,text});input.value='';}
 }catch(e){toast(e.message);}}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-tab]');if(nav){if(state.room)return;const tab=nav.dataset.tab;view(tab);refresh(tab);return;}const social=e.target.closest('[data-social]');if(social){state.socialMode=social.dataset.social;render();return;}const b=e.target.closest('[data-action]');if(b){clickAction(b);return;}if(e.target.id==='modal-backdrop')closeModal();});
document.addEventListener('submit',e=>{if(e.target.id==='auth-form')return;e.preventDefault();onForm(e.target);});
document.addEventListener('input',e=>{
 if(e.target?.id!=='find-user'||!state.cloud?.online||state.socialMode!=='search')return;
 const value=e.target.value;clearTimeout(searchDelay);
 if(value.trim().length<2){state.searchQuery=value;state.cloudSearch=null;state.searchRequestId++;const panel=$('#cloud-search-results');if(panel)panel.innerHTML='';return;}
 searchDelay=setTimeout(()=>cloudSearchIncremental(value),260);
});
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
  const out=await patch('/me',{photo:encoded});setMe(out.user);toast(firebaseReady()&&state.me.firebaseUid?'📷 الصورة اتحفظت وجاري مزامنتها على حسابك':'📷 الصورة اتحفظت على جهازك');render();
 }catch(err){toast('تعذر حفظ الصورة: '+err.message);}finally{if(url)URL.revokeObjectURL(url);}
});
function closePeer(){try{state.peer?.close();}catch{}state.peer=null;const audio=$('#remote-voice');if(audio)audio.remove();state.iceQueue=[];}
function buildPeer(remoteId){closePeer();const pc=state.peer=new RTCPeerConnection({iceServers:state.config.iceServers});
 for(const track of state.localStream.getTracks())pc.addTrack(track,state.localStream);
 pc.onicecandidate=e=>{if(e.candidate)state.socket.emit('voice:signal',{id:state.room.id,to:remoteId,data:{candidate:e.candidate}});};
 pc.ontrack=e=>{let el=$('#remote-voice');if(!el){el=document.createElement('audio');el.id='remote-voice';el.autoplay=true;el.playsInline=true;document.body.appendChild(el);}el.srcObject=e.streams[0];el.play().catch(()=>toast('اضغط أي مكان لتشغيل صوت المنافس'));};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')toast('تعذّر اتصال الصوت. قد يحتاج إعداد TURN');};return pc;}
async function requestVoice(){if(state.room?.watchOnly)return toast('المشاهد مش مسموح له يتكلم');if(state.voicePending)return toast('طلب المكالمة اتبعت بالفعل');
 await emit('voice:request',{id:state.room?.id});state.voicePending=true;openModal('📞 طلب اتصال صوتي','<p>📡 بعتنا طلب للمنافس. المايك مش هيفتح إلا لما يوافق.</p><button class="btn btn-secondary full" data-action="cancel-call">إلغاء</button>');
}
async function startVoiceSession(){if(!state.room||state.room.status!=='playing'||state.room.players.some(p=>p?.id==='bot'))throw Error('الصوت متاح للجولات بين لاعبين حقيقيين');
 if(!navigator.mediaDevices?.getUserMedia)throw Error('لازم تفتح الموقع بـ HTTPS علشان الميكروفون يشتغل');
 state.localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
 state.roomVoiceMuted=false;state.localStream.getAudioTracks().forEach(t=>t.enabled=true);
 try{const r=await emit('voice:join',{id:state.room.id});state.voice=true;state.voicePending=false;toast('🎤 المكالمة اتفتحت — لكل لاعب زر كتم مستقل');render();window.seegaSpectatorMedia?.broadcast(state.localStream);
  if(r.peers?.length){const pc=buildPeer(r.peers[0]);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await emit('voice:signal',{id:state.room.id,to:r.peers[0],data:{sdp:pc.localDescription}});}
 }catch(e){await voiceOff();throw e;}
}
async function onVoiceSignal({id,from,data}){if(!state.voice||!state.room||state.room.id!==id)return;try{
 const pc=state.peer||buildPeer(from);
 if(data.sdp){await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));for(const c of state.iceQueue)await pc.addIceCandidate(c);state.iceQueue=[];
  if(data.sdp.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);state.socket.emit('voice:signal',{id,to:from,data:{sdp:pc.localDescription}});}}
 else if(data.candidate){if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(data.candidate));else state.iceQueue.push(new RTCIceCandidate(data.candidate));}
 }catch(e){console.warn('Voice signaling',e);toast('اتصال الصوت اتعطّل');}}
async function voiceOff(){if(state.room)state.socket?.emit('voice:leave',{id:state.room.id});for(const track of state.localStream?.getTracks()||[])track.stop();state.localStream=null;state.voice=false;state.roomVoiceMuted=false;state.voicePending=false;window.seegaSpectatorMedia?.stop();closePeer();}
function authView(v){state.authView=v;document.querySelectorAll('[data-auth-view]').forEach(b=>b.classList.toggle('selected',b.dataset.authView===v));$('#auth-name-wrap').classList.toggle('hidden',v==='login');$('#auth-submit').textContent=v==='login'?'يلا ندخل نلعب':'أنشئ حسابي';$('#auth-form [name="password"]').autocomplete=v==='login'?'current-password':'new-password';}
async function authReady(u){
 if(firebaseReady()){
  try{
   const current=await firebaseCurrent();
   if(current?.uid&&u?.firebaseUid===current.uid){
    const remote=await cloudReadOrCreate(u),saved=await post('/me/cloud-sync',{profile:remote});u=saved.user;
   }
  }catch(e){
   // Authentication succeeded; a missing Firestore database must not trap the player at the login screen.
   // Only the local profile is available until protected cloud sync is enabled.
   if(u?.firebaseUid){
    state.cloud={online:false,friends:[],requests:[],publicChat:[],inbox:[],dm:[]};
    state.cloudSetupIssue='حفظ البروفايل السحابي يحتاج قواعد Firestore: '+e.message;
   }else state.cloudSetupIssue='المزامنة السحابية لم تكتمل: '+e.message;
  }
 }
 setMe(u);$('#auth-cover').classList.add('hidden');startSocket();state.config=await api('/config');state.store=state.config.items;if(state.me?.settings?.music)startMusic();else stopMusic();if(firebaseReady()&&state.me?.firebaseUid){
  cloudSocialStart(state.me,()=>state.room,data=>{state.cloud=data;updateSocialBadge();if(state.tab==='social'&&!state.room){if(state.socialMode==='search'){const host=$('#cloud-search-results');if(host)host.innerHTML=cloudSearchRows(state.cloudSearch);}else render();}},n=>{
   if(n.kind==='setup'||n.kind==='error'){
    state.cloudSetupIssue=n.text;
    // Startup permission warnings are available in the friends tab, never as repeated full-screen toasts.
    return;
   }
   if(n.kind==='dm'&&n.fromUid&&state.tab==='social'&&state.socialMode==='dm'&&state.cloud?.dmOther===n.fromUid&&!state.room){
    return; // Already reading this exact conversation; messages render live, no reopen popup.
   }
   notifyPlayer(n.text,{title:n.kind==='dm'?'رسالة جديدة':'إشعار من سيجا'});
   if(n.roomCode&&n.id&&!state.room){openModal('📨 دعوة مباراة',`<p>${esc(n.text)}</p><button class="btn btn-primary full" data-action="accept-invite" data-code="${esc(n.roomCode)}" data-notice="${esc(n.id)}">✅ موافقة والدخول</button><button class="btn btn-secondary full" data-action="decline-invite" data-notice="${esc(n.id)}">❌ رفض</button>`);}
   if(n.kind==='dm'&&n.fromUid&&!state.room){
    const sender=(state.cloud?.friends||[]).find(f=>f.uid===n.fromUid);
    openModal('💬 رسالة من '+(sender?.user?.name||'صاحبك'),`<p>${esc(n.text)}</p><button class="btn btn-primary full" data-action="cloud-dm" data-uid="${esc(n.fromUid)}">افتح المحادثة</button><button class="btn btn-secondary full" data-action="close-modal">لاحقًا</button>`);
   }
  }).catch(e=>{state.cloudSetupIssue='التواصل السحابي غير متاح: '+e.message;});
  matchInvitesStart({
   onIncoming:invite=>{
    if(state.room){notifyPlayer('🎲 طلب تحدي من '+(invite.fromName||'لاعب'),{title:'دعوة سيجا'});return;}
    notifyPlayer('🎲 '+(invite.fromName||'لاعب')+' طلب يلاعبك');
    if(!$('#modal-root')?.firstChild)
     openModal('🎲 طلب تحدي جديد',`<p>${esc(invite.fromName||'لاعب')} عايز يلعب معاك. تقبل ولا ترفض؟</p>
      <button class="btn btn-mint full" data-action="match-accept" data-id="${esc(invite.id)}" data-code="${esc(invite.roomCode)}">✅ موافقة</button>
      <button class="btn btn-secondary full" data-action="match-reject" data-id="${esc(invite.id)}">❌ رفض</button>`);
   },
   onUpdate:(incoming,outgoing)=>{
    state.matchInvites=incoming;state.outgoingInvites=outgoing;
    updateSocialBadge();if(state.tab==='social'&&!state.room&&state.socialMode==='friends')render();
    if(state.room?.kind==='online'&&state.room.status==='waiting')render();
   },
   onStatus:msg=>{if(msg.kind==='error'){state.cloudSetupIssue=msg.text;return;}notifyPlayer(msg.text);}
  }).catch(e=>{state.cloudSetupIssue='دعوات المباراة تحتاج صلاحيات Firestore المحدثة: '+e.message;});
  friendCallsStart({
   onIncoming:({id,uid})=>{
    state.pendingVoice={id,uid};
    const caller=(state.cloud?.friends||[]).find(f=>f.uid===uid);
    const name=caller?.user?.name||'صديقك';
    notifyPlayer('📞 مكالمة صوتية من '+name,{title:'مكالمة من سيجا رويال'});
    openModal('📞 مكالمة من '+name,`<p>صديقك بيطلب اتصال صوتي. الميكروفون مش هيفتح إلا بعد موافقتك.</p><div class="call-buttons"><button class="btn btn-mint" data-action="friend-call-accept">✅ رد</button><button class="btn btn-secondary" data-action="friend-call-decline">❌ رفض</button></div>`);
   },
   onChange:call=>{state.friendVoice=call;updateFriendVoiceBar();},
   onNotice:message=>{if(/Firebase|Firestore|permissions|قواعد|الصلاحيات/i.test(message)){state.cloudSetupIssue=message;return;}toast(message);}
  }).catch(e=>{state.cloudSetupIssue='مكالمات الأصدقاء تحتاج قواعد Firestore المحدثة: '+e.message;});
 }
 const match=location.pathname.match(/^\/(room|invite|watch)\/([A-Za-z0-9]{6})$/);const id=match?.[2];if(id){try{if(match[1]==='watch')await watchRoom(id);else await joinRoom(id);}catch(e){toast(e.message);window.history.replaceState({},'','/');view('home');}}else view('home');}
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{unlockAudio();let r;
 if(firebaseReady()){
  const profile=await firebaseEmail(state.authView,data.email,data.password,data.name);
  r=await post('/auth/federated',profile);
 }else r=await post(state.authView==='login'?'/auth/login':'/auth/register',data);
 await authReady(r.user);}catch(ex){toast(ex.message);}});
document.querySelectorAll('[data-auth-view]').forEach(b=>b.addEventListener('click',()=>authView(b.dataset.authView)));
$('#guest-login').addEventListener('click',async()=>{unlockAudio();try{if(firebaseReady())await firebaseLogout();const name=prompt('اسمك في اللعبة؟','لاعب سيجا')||'ضيف سيجا';const r=await post('/auth/guest',{name});await authReady(r.user);}catch(e){toast(e.message);}});
$('#google-login').addEventListener('click',async()=>{unlockAudio();try{const profile=await firebaseSignIn('google');const r=await post('/auth/federated',profile);await authReady(r.user);}catch(e){toast(e.message);}});
$('#facebook-login').addEventListener('click',async()=>{unlockAudio();try{const profile=await firebaseSignIn('facebook');const r=await post('/auth/federated',profile);await authReady(r.user);}catch(e){toast(e.message);}});
document.addEventListener('pointerdown',()=>{unlockGiftAudio();unlockAudio();if(state.me?.settings?.music)startMusic();},{capture:true,passive:true});
(async function boot(){try{if(firebaseReady()){const note=$('.auth-local-notice');if(note)note.textContent='☁️ حساب Firebase يفعّل الصورة والـ ID والأصدقاء والشات عند جاهزية Firestore وقواعد الأمان. الكوينز والترتيب محليان. يمكنك تجربة الحساب بين جهازين.';}state.config=await api('/config');state.store=state.config.items;const r=await api('/me');if(r.user){
  if(firebaseReady()){
   const cloud=await firebaseCurrent();
   if(cloud?.uid&&cloud.uid!==r.user.firebaseUid){
    const next=await post('/auth/federated',cloud);await authReady(next.user);
   }else await authReady(r.user);
  }else await authReady(r.user);
 }
 else if(firebaseReady()){ 
  try{const cloud=await firebaseCurrent();if(cloud){const res=await post('/auth/federated',cloud);await authReady(res.user);}else $('#auth-cover').classList.remove('hidden');}
  catch(e){$('#auth-cover').classList.remove('hidden');toast('تعذّر فتح الحساب السحابي: '+e.message);}
 }else $('#auth-cover').classList.remove('hidden');if(location.search.includes('autherror'))toast('فشل الدخول الاجتماعي؛ راجع الإعدادات');}catch(e){toast('تعذّر تشغيل الحساب: '+e.message+' — يمكنك تجربة وضع الضيف لحين تفعيل Firebase.');$('#auth-cover').classList.remove('hidden');}})();