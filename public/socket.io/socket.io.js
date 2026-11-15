// Minimal dependency-free realtime transport: authenticated HTTP long polling.
// Exposes a small Socket.IO-shaped client interface for the game UI.
(function(){
 window.io=function(){
  const handlers=new Map();let connection=false,identity=null,since=-1,polling=false;
  const api={connected:false,on(name,callback){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);return api;},emit(name,data,callback){send(name,data,callback);return api;}};
  function fire(name,data){for(const fn of handlers.get(name)||[])try{fn(data);}catch(err){console.error(err)}}
  function connected(yes){if(connection!==yes){connection=yes;api.connected=yes;fire(yes?'connect':'disconnect');}}
  async function post(name,payload,signal){const res=await fetch('/api/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal});return res.json();}
  async function send(name,data,callback){try{
    const body=name==='create_room'||name==='join_room'?{...data}:{...identity,action:data};
    const result=await post(name==='create_room'?'create_room':name==='join_room'?'join_room':name,body);
    if(result.ok&&(name==='create_room'||name==='join_room')){identity={code:result.code,token:result.token};since=-1;if(!polling)poll();}
    callback?.(result);
  }catch(e){connected(false);callback?.({ok:false,error:'الاتصال بالسيرفر مش شغال. جرب تاني.'});}}
  async function poll(){if(polling)return;polling=true;
    while(identity){try{
      const result=await post('poll',{...identity,since});
      if(!result.ok){fire('error',result.error);identity=null;break;}
      connected(true);since=result.version;fire('room_state',result.room_state);
    }catch(e){connected(false);await new Promise(resolve=>setTimeout(resolve,1400));}}
    polling=false;
  }
  async function health(){for(;;){try{const r=await fetch('/healthz',{cache:'no-store'});if(r.ok){connected(true);return;}}catch{}connected(false);await new Promise(resolve=>setTimeout(resolve,2000));}}
  health();return api;
 };
})();
