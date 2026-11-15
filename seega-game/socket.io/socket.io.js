// Free browser-to-browser online rooms using the public PeerJS Cloud signalling service.
// The room owner acts as the authoritative game host. No paid backend is required.
(function () {
  'use strict';
  window.io = function () {
  const handlers = new Map();
  const calls = new Map();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const peerPrefix = 'seega-fallahi-v1-';
  const savedRoomKey = code => 'seega:host:' + code;
  const cleanCode = v => String(v || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  const cleanName = v => String(v || '').trim().replace(/[<>\x00-\x1f]/g, '').slice(0, 24) || 'لاعب';
  const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('');
  const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
  const gameModule = import('../game.mjs');
  let peer = null, hostRoom = null, guestConn = null, activeGuest = null;
  let reconnectToken = null, reconnectName = null;
  let peerConnected = false;
  let pendingJoin = null, requestNum = 0;
  const api = {
    connected: false,
    on(name, cb) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(cb); return api; },
    emit(name, data, callback) { dispatch(name, data || {}, callback || (()=>{})); return api; },
  };
  function fire(name, value) { for (const cb of handlers.get(name) || []) { try { cb(value); } catch (e) { console.error(e); } } }
  function connectionStatus(value) { if (peerConnected === value) return; peerConnected = value; api.connected = value; fire(value ? 'connect' : 'disconnect'); }
  function playerPacket(room, seat) {
    return { code:room.code, size:room.game.size, drops:room.game.drops,
      players:room.players.map((p, i) => p ? {name:p.name,online:i===0?peerConnected:!!(activeGuest?.open),seat:i} : null),
      game:room.game, you:seat, rematch:room.rematch.slice() };
  }
  function persist() { if (hostRoom) try {localStorage.setItem(savedRoomKey(hostRoom.code),JSON.stringify(hostRoom));} catch (_) {} }
  function publish() {
    if (!hostRoom) return;
    persist();
    fire('room_state', playerPacket(hostRoom,0));
    if (activeGuest?.open) try { activeGuest.send({kind:'state',value:playerPacket(hostRoom,1)}); } catch (_) {}
  }
  function cleanupPending(message) {
    for (const [, v] of calls) {clearTimeout(v.timer); v.callback({ok:false,error:message});}
    calls.clear();
  }
  function setPeerEvents(p) {
    p.on('open', () => connectionStatus(true));
    p.on('disconnected', () => {
      if (!p.destroyed) try {p.reconnect();} catch (_) {}
      if (!activeGuest?.open) connectionStatus(false);
    });
    p.on('error', e => {
      if (e.type === 'peer-unavailable' && pendingJoin) {
        pendingJoin.callback({ok:false,error:'مش لاقيين الأوضة. لازم صاحبك يكون فاتح اللعبة ومتصل بالإنترنت.'});
        pendingJoin = null;
      } else if (e.type === 'unavailable-id' && hostRoom) {
        fire('error','كود الأوضة مستخدم، جرّب أوضة جديدة');
      } else { fire('error',e?.message || 'مشكلة في الاتصال'); }
    });
    p.on('connection', conn => {
      if (!hostRoom) {conn.close();return;}
      let authorised = false;
      conn.on('data', async msg => {
        if (!msg || typeof msg !== 'object' || !['join','play','rematch'].includes(msg.action)) return;
        const reply = (result) => { if (conn.open) conn.send({kind:'reply',id:msg.id,result}); };
        if (msg.action === 'join') {
          let token = String(msg.data?.token || '');
          const room = hostRoom;
          if (!room) {reply({ok:false,error:'الأوضة مش موجودة'});return;}
          if (!room.players[1]) {
            token = randomToken();
            room.players[1] = {name:cleanName(msg.data?.name),token};
          } else if (token !== room.players[1].token || !token) {
            reply({ok:false,error:'الأوضة فيها لاعبين بالفعل'});return;
          }
          if (activeGuest && activeGuest !== conn) try {activeGuest.close();} catch (_) {}
          activeGuest = conn;
          authorised = true;
          reply({ok:true,code:room.code,token});
          publish();
          return;
        }
        if (!authorised || activeGuest !== conn) {reply({ok:false,error:'لازم تدخل الأوضة الأول'});return;}
        const result = await hostAction(1,msg.action,msg.data);
        reply(result);
      });
      conn.on('close', () => {if (activeGuest === conn) {activeGuest=null;publish();}});
      conn.on('error', () => {if (activeGuest === conn) {activeGuest=null;publish();}});
    });
  }
  function freshPeer(id) {
    if (peer) {try {peer.destroy();} catch (_) {}}
    connectionStatus(false);
    peer = new Peer(id);
    setPeerEvents(peer);
    return peer;
  }
  async function startHost(room, callback) {
    hostRoom = room;
    activeGuest = null;
    const p = freshPeer(peerPrefix + room.code);
    const timer = setTimeout(() => callback({ok:false,error:'الاتصال بخدمة اللعب استغرق وقت طويل. جرّب تاني'}),14000);
    p.on('open', () => {clearTimeout(timer);persist();publish();callback({ok:true,code:room.code,token:room.players[0].token});});
    p.on('error', e => {if(e.type==='unavailable-id'||e.type==='network'||e.type==='server-error'){clearTimeout(timer);callback({ok:false,error:'تعذّر تجهيز الأوضة. جرّب مرة تانية'});}});
  }
  function joinGuest(data,callback) {
    const code = cleanCode(data.code);
    if (!code || code.length !== 6) return callback({ok:false,error:'لينك الأوضة مش صحيح'});
    reconnectToken = data.token || null;
    reconnectName = cleanName(data.name);
    if (!peer?.open) return callback({ok:false,error:'لسه بنوصل بخدمة اللعبة، جرّب تاني'});
    if (guestConn) try {guestConn.close();} catch (_) {}
    const conn = peer.connect(peerPrefix + code,{reliable:true});
    guestConn = conn;
    pendingJoin = {callback};
    const timer = setTimeout(() => {if (pendingJoin?.callback===callback) { pendingJoin=null;callback({ok:false,error:'صاحبك مش متصل حاليًا. خلي صاحبك يفتح الأوضة الأول'}); }},17000);
    conn.on('open',() => {
      clearTimeout(timer);
      submit(conn,'join',{name:reconnectName,token:reconnectToken},res => {
        if (pendingJoin?.callback === callback) pendingJoin = null;
        if (res.ok) reconnectToken = res.token;
        callback(res);
      });
    });
    conn.on('data',msg => {
      if (msg?.kind === 'reply') {
        const c = calls.get(msg.id);
        if (c) {calls.delete(msg.id);clearTimeout(c.timer);c.callback(msg.result);}
      } else if (msg?.kind === 'state') {
        fire('room_state',msg.value);
      }
    });
    conn.on('close', () => {
      if (guestConn!==conn) return;
      connectionStatus(false);
      fire('error','صاحب الأوضة فصل الاتصال. افتح نفس اللينك لما يرجع.');
      cleanupPending('اتقطع الاتصال بصاحبك');
    });
    conn.on('error', () => {
      if (pendingJoin?.callback===callback) {clearTimeout(timer);pendingJoin=null;callback({ok:false,error:'مش قادرين نوصل لصاحب الأوضة'});}
    });
  }
  function submit(conn, action, data, callback) {
    if (!conn?.open) {callback({ok:false,error:'اللاعب التاني مش متصل'});return;}
    const id = ++requestNum;
    const timer = setTimeout(() => {if(calls.has(id)){calls.delete(id);callback({ok:false,error:'الاتصال بطيء، جرّب تاني'});}},15000);
    calls.set(id,{callback,timer});
    conn.send({id,action,data});
  }
  async function hostAction(seat, action, data) {
    try {
      if (!hostRoom) throw Error('الأوضة مش موجودة');
      const rules = await gameModule;
      if (action === 'play') {
        if (!hostRoom.players[1]) throw Error('استنى صاحبك يدخل الأوضة');
        hostRoom.game = rules.apply(hostRoom.game,seat,data);
        hostRoom.rematch = [false,false];
      } else if (action === 'rematch') {
        if (hostRoom.game.phase !== 'done') throw Error('الماتش لسه مخلصش');
        hostRoom.rematch[seat] = true;
        if (hostRoom.rematch.every(Boolean)) {
          hostRoom.game = rules.newGame(hostRoom.game.size,hostRoom.game.drops,1-hostRoom.game.first);
          hostRoom.rematch = [false,false];
        }
      } else throw Error('طلب غير معروف');
      publish();return {ok:true};
    } catch (e) {return {ok:false,error:e?.message || 'نقلة غير صحيحة'};}
  }
  async function dispatch(action, data, callback) {
    try {
      if (action === 'create_room') {
        const rules = await gameModule;
        if (![5,7].includes(Number(data.size)) || ![1,2].includes(Number(data.drops))) throw Error('إعدادات الرقعة مش صحيحة');
        const code = randomCode();
        await startHost({code,game:rules.newGame(Number(data.size),Number(data.drops)),players:[{name:cleanName(data.name),token:randomToken()},null],rematch:[false,false]},callback);
      } else if (action === 'join_room') {
        const code = cleanCode(data.code);
        let saved = null;
        try {saved=JSON.parse(localStorage.getItem(savedRoomKey(code))||'null');}catch(_){}
        if (hostRoom?.code===code && data.token===hostRoom.players[0].token) {
          callback({ok:true,code,token:data.token});publish();
        } else if (saved?.code===code && data.token && data.token===saved.players?.[0]?.token) {
          await startHost(saved,callback);
        } else joinGuest(data,callback);
      } else if (action === 'play' || action === 'rematch') {
        if (hostRoom) callback(await hostAction(0,action,data));
        else submit(guestConn,action,data,callback);
      } else callback({ok:false,error:'طلب غير معروف'});
    } catch (e) {callback({ok:false,error:e?.message||'حصلت مشكلة'});}
  }
  if (typeof Peer !== 'function') {
    setTimeout(() => fire('error','مكتبة الاتصال مش موجودة. اتأكد إن الإنترنت شغال.'),0);
  } else freshPeer(undefined);
  return api;
 };
})();
