// Egyptian Seega v5: browser MQTT relay (two independent public WSS brokers)
// and a local three-level AI. Anonymous public MQTT is for casual games only:
// do not transmit sensitive data. The room creator remains authoritative.
(function () {
'use strict';
const BURLS=['wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const ROOT='egypt-seega/fallahi/v5/';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tx=new TextEncoder(),rx=new TextDecoder();
const uid=(n=12)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>alphabet[v%alphabet.length]).join('');
const clean=v=>String(v||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
const cleanName=v=>String(v||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,24)||'لاعب';
const key=c=>'seega:host:'+c;
const utf8=s=>{const b=tx.encode(String(s));return Uint8Array.from([b.length>>8,b.length&255,...b]);};
const concat=(...data)=>{const size=data.reduce((n,b)=>n+b.length,0),result=new Uint8Array(size);let off=0;for(const b of data){result.set(b,off);off+=b.length;}return result;};
function mqttPacket(header,body){const size=[];let n=body.length;do{let v=n%128;n=Math.floor(n/128);if(n)v|=128;size.push(v);}while(n);return concat(Uint8Array.from([header,...size]),body);}
class Transport {
 constructor(url,onMessage,onStatus){this.url=url;this.message=onMessage;this.status=onStatus;this.ready=false;this.subscribed=false;this.topic=null;this.ws=null;this.pid=0;this.pendingSubs=new Map();this.buffer=new Uint8Array(0);this.delay=900;this.closed=false;this.reconnect();}
 send(header,body){if(this.ws?.readyState===1)this.ws.send(mqttPacket(header,body));}
 reconnect(){if(this.closed)return;try{
   const ws=new WebSocket(this.url,['mqtt']);ws.binaryType='arraybuffer';this.ws=ws;this.buffer=new Uint8Array(0);
   const connectTimeout=setTimeout(()=>{if(!this.ready){try{ws.close();}catch(_){}}},11000);
   ws.onopen=()=>{if(this.ws!==ws)return;const clientId='sg'+uid(9);this.send(0x10,concat(utf8('MQTT'),Uint8Array.from([4,2,0,30]),utf8(clientId)));};
   ws.onmessage=e=>{if(this.ws!==ws)return;try{this.receive(new Uint8Array(e.data));}catch(err){console.warn('MQTT packet ignored',err);}};
   ws.onerror=()=>{try{ws.close();}catch(_){}};
   ws.onclose=()=>{clearTimeout(connectTimeout);if(this.ws!==ws)return;this.ready=false;this.subscribed=false;this.pendingSubs.clear();this.status();if(!this.closed)setTimeout(()=>this.reconnect(),this.delay+Math.random()*650);this.delay=Math.min(this.delay*1.6,10000);};
 }catch(e){this.ready=false;this.status();setTimeout(()=>this.reconnect(),this.delay+Math.random()*700);this.delay=Math.min(this.delay*1.6,10000);}}
 receive(data){this.buffer=concat(this.buffer,data);let at=0;while(at<this.buffer.length){const start=at,header=this.buffer[at++];let remaining=0,multiplier=1,part,count=0;do{if(at>=this.buffer.length){this.buffer=this.buffer.slice(start);return;}part=this.buffer[at++];remaining+=(part&127)*multiplier;multiplier*=128;count++;if(count>4)throw Error('Malformed MQTT size');}while(part&128);
  if(at+remaining>this.buffer.length){this.buffer=this.buffer.slice(start);return;}
  const body=this.buffer.slice(at,at+remaining);at+=remaining;this.handle(header,body);
 }this.buffer=new Uint8Array(0);}
 handle(header,body){const type=header>>4;
  if(type===2){if(body[1]!==0){try{this.ws.close();}catch(_){};return;}this.ready=true;this.delay=900;this.status();if(this.topic)this.subscribe(this.topic);this.pinger&&clearInterval(this.pinger);this.pinger=setInterval(()=>{if(this.ready)this.send(0xc0,new Uint8Array());},12000);}
  else if(type===9){const pid=(body[0]<<8)|body[1];if(this.pendingSubs.has(pid)){this.pendingSubs.delete(pid);this.subscribed=true;this.status();}}
  else if(type===3){const len=(body[0]<<8)|body[1];if(body.length<len+2)return;const topic=rx.decode(body.slice(2,len+2));const qos=(header&6)>>1;const offset=2+len+(qos?2:0);try{this.message(topic,JSON.parse(rx.decode(body.slice(offset))));}catch(_) {}}
 }
 subscribe(topic){this.topic=topic;this.subscribed=false;if(!this.ready)return;const pid=++this.pid%65534+1;this.pendingSubs.set(pid,topic);this.send(0x82,concat(Uint8Array.from([pid>>8,pid&255]),utf8(topic),Uint8Array.from([0])));}
 publish(topic,msg){if(!this.ready||!this.subscribed||this.topic!==topic)return false;this.send(0x30,concat(utf8(topic),tx.encode(JSON.stringify(msg))));return true;}
 shutdown(){this.closed=true;clearInterval(this.pinger);try{this.ws?.close();}catch(_){}}
}
window.io=function(){
 const listeners=new Map(),clientId=uid(),transports=[];
 const rules=import('../game.mjs'),botLogic=import('../bot.mjs');
 let room=null,guest=null,mode=null,topic=null,botLevel='medium',botTimer=null,previousOnline=false;
 let guestLast=0,hostLast=0,latestHostId=null,guestTimer=null,joining=null;
 let seq=0,epoch=0;const requests=new Map(),seen=new Map(),joinResponses=new Map();
 const api={connected:false,on(event,cb){if(!listeners.has(event))listeners.set(event,[]);listeners.get(event).push(cb);if(event==='connect'&&api.connected)queueMicrotask(()=>cb());return api;},emit(event,data,cb){dispatch(event,data||{},cb||(()=>{}));return api;}};
 function emit(event,value){for(const f of listeners.get(event)||[])try{f(value);}catch(e){console.error(e);}}
 function connected(){return transports.some(t=>t.ready&&(!topic||t.subscribed));}
 function status(){api.connected=connected();if(api.connected!==previousOnline){previousOnline=api.connected;emit(api.connected?'connect':'disconnect');}
   if(api.connected){if(room&&mode==='host')publishState();if(guest&&mode==='guest')sendJoin();}
   emit('transport_status',{online:api.connected,channels:transports.filter(t=>t.ready&&t.subscribed).length});
 }
 function setTopic(c){topic=ROOT+c;for(const t of transports)t.subscribe(topic);}
 function send(kind,data={}){if(!topic)return false;const msg={version:5,kind,sender:clientId,mid:uid(8),at:Date.now(),...data};return transports.map(t=>t.publish(topic,msg)).some(Boolean);}
 function alive(){return mode==='host'&&room?.players?.[1]&&Date.now()-guestLast<25000;}
 function packet(seat){return {code:room.code,game:room.game,size:room.game.size,drops:room.game.drops,players:room.players.map((p,i)=>p?{name:p.name,online:i===0?connected():alive(),seat:i}:null),you:seat,rematch:room.rematch.slice(),isBot:mode==='bot',difficulty:botLevel};}
 function persist(){if(mode==='host'&&room){try{localStorage.setItem(key(room.code),JSON.stringify(room));}catch(_){}}}
 function publishState(){if(!room)return;persist();if(mode==='bot'){const p=packet(0);p.players[1].online=true;emit('room_state',p);return;}
  emit('room_state',packet(0));
  if(mode==='host')send('state',{roomId:room.roomId,payload:packet(1)});
 }
 function message(topicReceived,msg){if(topicReceived!==topic||!msg||msg.version!==5||msg.sender===clientId||!['join','join_reply','heartbeat','state','action','action_reply','host_ping'].includes(msg.kind))return;
  if(msg.kind==='join'&&mode==='host'&&room){handleJoin(msg);return;}
  if(msg.kind==='action'&&mode==='host'&&room){handleAction(msg);return;}
  if(msg.kind==='heartbeat'&&mode==='host'&&room){if(room.players[1]?.token===msg.token){guestLast=Date.now();}return;}
  if(mode!=='guest'||!guest)return;
  if(msg.kind==='join_reply'&&msg.to===clientId&&joining&&msg.request===joining.id){
   clearInterval(joining.timer);clearTimeout(joining.timeout);
   if(msg.ok){guest.token=msg.token;latestHostId=msg.roomId;hostLast=Date.now();joining.done({ok:true,code:guest.code,token:msg.token});joining=null;
     send('heartbeat',{token:guest.token});send('join',{request:uid(8),name:guest.name,token:guest.token,session:clientId});
   }else{joining.done({ok:false,error:msg.error||'تعذر دخول الغرفة'});joining=null;}return;
  }
  if(msg.kind==='state'&&(!latestHostId||msg.roomId===latestHostId)&&msg.payload?.code===guest.code){
   latestHostId=msg.roomId;hostLast=Date.now();guest.state=msg.payload;emit('room_state',guest.state);return;
  }
  if(msg.kind==='host_ping'&&msg.roomId===latestHostId){hostLast=Date.now();return;}
  if(msg.kind==='action_reply'&&msg.to===clientId&&requests.has(msg.request)){
   const r=requests.get(msg.request);clearInterval(r.timer);clearTimeout(r.timeout);requests.delete(msg.request);r.done(msg.result);return;
  }
 }
 function handleJoin(msg){const req=msg.request,existing=room.players[1];if(!req||!msg.session)return;
  const key=msg.session+':'+req;
  if(joinResponses.has(key)){
    send('join_reply',{to:msg.session,request:req,roomId:room.roomId,...joinResponses.get(key)});
    return;
  }
  let result;
  if(!existing){const token=uid(24);room.players[1]={name:cleanName(msg.name),token};guestLast=Date.now();persist();result={ok:true,token};}
  else if(msg.token&&msg.token===existing.token){guestLast=Date.now();result={ok:true,token:existing.token};}
  else result={ok:false,error:'الأوضة فيها لاعبين بالفعل. اطلب من صاحبك يعمل أوضة جديدة.'};
  joinResponses.set(key,result);if(joinResponses.size>300)joinResponses.delete(joinResponses.keys().next().value);
  send('join_reply',{to:msg.session,request:req,roomId:room.roomId,...result});if(result.ok)publishState();
 }
 async function processAction(seat,action,data){try{if(!room)throw Error('الأوضة مش متاحة');const mod=await rules;
   if(action==='play'){if(!room.players[1])throw Error('استنى صاحبك يدخل');room.game=mod.apply(room.game,seat,data);room.rematch=[false,false];}
   else if(action==='rematch'){
    if(room.game.phase!=='done')throw Error('الماتش لسه مخلصش');
    if(mode==='bot'){room.game=mod.newGame(room.game.size,room.game.drops,1-room.game.first);room.rematch=[false,false];}
    else{room.rematch[seat]=true;if(room.rematch.every(Boolean)){room.game=mod.newGame(room.game.size,room.game.drops,1-room.game.first);room.rematch=[false,false];}}
   }else throw Error('طلب غير معروف');
   publishState();if(mode==='bot')maybeBot();return {ok:true};
  }catch(e){return {ok:false,error:e?.message||'نقلة غير صحيحة'};}}
 function handleAction(msg){if(!msg.request||!room.players[1]||!msg.session)return;
  if(msg.token!==room.players[1].token){send('action_reply',{to:msg.session,request:msg.request,result:{ok:false,error:'غير مسموح باللعب في الأوضة'}});return;}
  const k=msg.token+':'+msg.request;
  if(!seen.has(k)){seen.set(k,processAction(1,msg.action,msg.data));if(seen.size>400){const first=seen.keys().next().value;seen.delete(first);}}
  seen.get(k).then(result=>send('action_reply',{to:msg.session,request:msg.request,result}));
 }
 function maybeBot(){if(mode!=='bot'||!room||room.game.phase==='done'||room.game.turn!==1||botTimer)return;
  botTimer=setTimeout(async()=>{botTimer=null;if(mode!=='bot'||room?.game.turn!==1)return;try{const model=await botLogic;const action=model.chooseBotMove(room.game,1,botLevel);if(action){const result=await processAction(1,'play',action);if(!result.ok)console.warn('bot move rejected',result.error);}}catch(e){console.error('bot failed',e);}},botLevel==='easy'?520:botLevel==='medium'?400:300);
 }
 function stopBot(){clearTimeout(botTimer);botTimer=null;}
 function sendJoin(){if(!guest||mode!=='guest'||!joining)return;send('join',{request:joining.id,name:guest.name,token:guest.token||'',session:clientId});}
 function join(data,callback){const c=clean(data.code);if(c.length!==6)return callback({ok:false,error:'كود الغرفة مش صحيح'});
  // The game owner may restore the saved host state after reopening the same link.
  let saved=null;try{saved=JSON.parse(localStorage.getItem(key(c))||'null');}catch(_){ }
  if((mode==='host'&&room?.code===c&&data.token===room.players[0].token)||(saved?.code===c&&data.token&&data.token===saved.players?.[0]?.token)){
    room=(mode==='host'&&room?.code===c)?room:saved;room.roomId ||=uid(18);mode='host';guest=null;setTopic(c);
    return waitForOnline(()=>{publishState();callback({ok:true,code:c,token:room.players[0].token});},callback);
  }
  mode='guest';room=null;stopBot();guest={code:c,name:cleanName(data.name),token:data.token||''};setTopic(c);latestHostId=null;
  if(joining){clearInterval(joining.timer);clearTimeout(joining.timeout);}
  const id=uid(12);
  const state={id,done:callback,timer:null,timeout:null};joining=state;
  state.timer=setInterval(()=>{if(joining===state)sendJoin();},1500);
  state.timeout=setTimeout(()=>{if(joining===state){clearInterval(state.timer);joining=null;callback({ok:false,error:'مش قادرين نوصل لصاحب الأوضة. اتأكد إنه فاتح اللعبة، وجرب لينك الدعوة تاني.'});}},22000);
  sendJoin();
 }
 function waitForOnline(done,fail){if(connected())return done();let complete=false;const check=setInterval(()=>{if(connected()&&!complete){complete=true;clearInterval(check);clearTimeout(timeout);done();}},250);
 const timeout=setTimeout(()=>{if(!complete){complete=true;clearInterval(check);fail({ok:false,error:'مش متصل بخدمة اللعب. جرّب بيانات الموبايل أو شبكة تانية.'});}},16000);}
 function remoteAction(action,data,callback){if(!guest?.token)return callback({ok:false,error:'ادخل الأوضة الأول'});
  const request=uid(12);const payload={request,session:clientId,token:guest.token,action,data};
  const timer=setInterval(()=>send('action',payload),1300);
  const timeout=setTimeout(()=>{clearInterval(timer);requests.delete(request);callback({ok:false,error:'النقلة ما وصلتش. جرّب تاني لما الاتصال يرجع.'});},17000);
  requests.set(request,{timer,timeout,done:callback});send('action',payload);
 }
 async function dispatch(action,data,callback){try{
  if(action==='create_bot'){
   const mod=await rules;stopBot();mode='bot';guest=null;joining=null;room={code:'BOT',roomId:uid(12),game:mod.newGame(Number(data.size),Number(data.drops)),players:[{name:cleanName(data.name),token:uid()},{name:'🤖 الكمبيوتر',token:'bot'}],rematch:[false,false]};
   botLevel=['easy','medium','hard'].includes(data.difficulty)?data.difficulty:'medium';publishState();callback({ok:true,code:'BOT',token:room.players[0].token});return;
  }
  if(action==='create_room'){
   const mod=await rules;if(![5,7].includes(Number(data.size))||![1,2].includes(Number(data.drops)))throw Error('إعدادات الرقعة مش صحيحة');
   stopBot();mode='host';guest=null;joining=null;room={code:code(),roomId:uid(18),game:mod.newGame(Number(data.size),Number(data.drops)),players:[{name:cleanName(data.name),token:uid(24)},null],rematch:[false,false]};setTopic(room.code);
   return waitForOnline(()=>{persist();publishState();callback({ok:true,code:room.code,token:room.players[0].token});},callback);
  }
  if(action==='join_room')return join(data,callback);
  if(action==='play'||action==='rematch'){
   if(mode==='bot'||mode==='host')return callback(await processAction(0,action,data));
   if(mode==='guest')return remoteAction(action,data,callback);
   throw Error('ادخل أوضة الأول');
  }
  throw Error('طلب غير معروف');
 }catch(e){callback({ok:false,error:e?.message||'حصلت مشكلة'});}}
 // 6-second presence heartbeat: both peers remain on the same topic even after reconnect.
 setInterval(()=>{if(mode==='guest'&&guest?.token){send('heartbeat',{token:guest.token});
   if(latestHostId&&Date.now()-hostLast>22000&&guest.state){
     const snapshot={...guest.state,players:guest.state.players.map((p,i)=>i===0&&p?{...p,online:false}:p)};
     emit('room_state',snapshot);
   }
 }else if(mode==='host'&&room){send('host_ping',{roomId:room.roomId});publishState();}
 },6000);
 for(const url of BURLS)transports.push(new Transport(url,message,status));
 // Prevent missed initial broker status when the browser opens a fast connection.
 queueMicrotask(status);
 return api;
};
})();
