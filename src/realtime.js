import crypto from 'node:crypto';
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function encodeFrame(value){const bytes=Buffer.from(JSON.stringify(value));const l=bytes.length;const head=l<126?2:l<65536?4:10;const buf=Buffer.alloc(head+l);buf[0]=0x81;
 if(l<126)buf[1]=l;else if(l<65536){buf[1]=126;buf.writeUInt16BE(l,2);}else{buf[1]=127;buf.writeBigUInt64BE(BigInt(l),2);}bytes.copy(buf,head);return buf;}
class Client{
 constructor(server,raw,req){this.server=server;this.raw=raw;this.data={};this.handshake={headers:req.headers};this.rooms=new Set();this.handlers=new Map();this.buffer=Buffer.alloc(0);this.connected=true;
 raw.on('data',chunk=>this.receive(chunk));raw.on('close',()=>this.close());raw.on('error',()=>this.close());}
 on(event,fn){if(!this.handlers.has(event))this.handlers.set(event,[]);this.handlers.get(event).push(fn);}
 join(room){this.rooms.add(room);if(!this.server.rooms.has(room))this.server.rooms.set(room,new Set());this.server.rooms.get(room).add(this);}
 leave(room){this.rooms.delete(room);this.server.rooms.get(room)?.delete(this);}
 to(room){return {emit:(event,data)=>this.server.sendTo([room],event,data,new Set([this]))};}
 emit(event,data){this.send({event,data});}
 send(data){if(this.connected&&!this.raw.destroyed)try{this.raw.write(encodeFrame(data));}catch{}}
 receive(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);while(this.buffer.length>=2){let size=this.buffer[1]&0x7f;const op=this.buffer[0]&15;let off=2;
  if(size===126){if(this.buffer.length<4)return;size=this.buffer.readUInt16BE(2);off=4;}
  else if(size===127){if(this.buffer.length<10)return;const big=this.buffer.readBigUInt64BE(2);if(big>BigInt(32768)){this.raw.destroy();return;}size=Number(big);off=10;}
  if(size>32768){this.raw.destroy();return;}const masked=!!(this.buffer[1]&0x80);const needed=off+(masked?4:0)+size;if(this.buffer.length<needed)return;
  const frame=this.buffer.subarray(off+(masked?4:0),needed);const payload=Buffer.from(frame);
  if(masked){const mask=this.buffer.subarray(off,off+4);for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];}
  this.buffer=this.buffer.subarray(needed);
  if(op===8){this.raw.end();return;}if(op===9){this.raw.write(Buffer.from([0x8a,0x00]));continue;}if(op!==1)continue;
  try{const obj=JSON.parse(payload.toString('utf8'));if(typeof obj.event!=='string')continue;const acknowledge=reply=>{if(obj.ack!==undefined)this.send({ack:obj.ack,response:reply||{}});};
   for(const fn of this.handlers.get(obj.event)||[]){Promise.resolve().then(()=>fn(obj.data||{},acknowledge)).catch(e=>{console.error('Socket event:',e);acknowledge({error:'حدث خطأ'});});}
  }catch{}
 }}
 close(){if(!this.connected)return;this.connected=false;this.server.clients.delete(this);for(const room of this.rooms)this.leave(room);for(const fn of this.handlers.get('disconnect')||[])fn();}
}
export class Realtime{
 constructor(server){this.server=server;this.clients=new Set();this.rooms=new Map();this.middleware=[];this.listeners={};server.on('upgrade',(req,raw)=>{
  if(!req.url?.startsWith('/ws')||!req.headers['sec-websocket-key'])return raw.destroy();const origin=req.headers.origin;
  // Only allow same-origin browser sessions to create a socket.
  if(origin){try{if(new URL(origin).host!==req.headers.host)return raw.destroy();}catch{return raw.destroy();}}
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+GUID).digest('base64');raw.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const client=new Client(this,raw,req);let n=0;const next=(err)=>{if(err){client.raw.destroy();return;}if(n<this.middleware.length)return this.middleware[n++](client,next);this.clients.add(client);this.listeners.connection?.(client);};next();
 });}
 on(event,fn){this.listeners[event]=fn;}
 use(fn){this.middleware.push(fn);}
 sendTo(rooms,event,data,exclude){const targets=new Set();for(const name of rooms)for(const c of this.rooms.get(name)||[])targets.add(c);for(const c of targets)if(!exclude?.has(c))c.emit(event,data);}
 to(room){return {emit:(event,data)=>this.sendTo([room],event,data),to:(next)=>({emit:(event,data)=>this.sendTo([room,next],event,data)})};}
 emit(event,data){for(const c of this.clients)c.emit(event,data);}
}