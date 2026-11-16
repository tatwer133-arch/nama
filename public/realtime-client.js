// Small zero-dependency browser realtime client. Uses native WebSocket and acks.
(function(){window.io=function(){const handlers=new Map(),acks=new Map();let ws=null,n=0,closed=false,tries=0;
 const socket={connected:false,on(event,fn){if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(fn);return socket;},once(event,fn){const once=(...args)=>{socket.off(event,once);fn(...args);};return socket.on(event,once);},off(event,fn){handlers.set(event,(handlers.get(event)||[]).filter(x=>x!==fn));},emit(event,data,cb){if(!socket.connected){cb?.({error:'الاتصال مقطوع'});return;}const id=cb?++n:undefined;if(cb){acks.set(id,cb);setTimeout(()=>{if(acks.has(id)){acks.delete(id);cb({error:'السيرفر ما ردش، حاول تاني'});}},12000);}ws.send(JSON.stringify({event,data,ack:id}));},disconnect(){closed=true;socket.connected=false;ws?.close();}};
 function fire(e,v){for(const fn of handlers.get(e)||[])try{fn(v);}catch(err){console.error(err);}}
 function connect(){if(closed)return;const proto=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(`${proto}//${location.host}/ws`);
 ws.onopen=()=>{socket.connected=true;tries=0;fire('connect');if(n>0)fire('reconnect');};
 ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.ack!==undefined){const cb=acks.get(m.ack);acks.delete(m.ack);cb?.(m.response);return;}fire(m.event,m.data);}catch{}};
 ws.onerror=()=>{fire('connect_error');};ws.onclose=()=>{socket.connected=false;if(!closed)setTimeout(connect,Math.min(12000,1000*Math.pow(1.5,tries++)));};}
 connect();return socket;};})();