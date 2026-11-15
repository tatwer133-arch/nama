import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, apply } from './game.mjs';

const PORT = Number(process.env.PORT) || 3000;
const ROOT=join(fileURLToPath(new URL('.',import.meta.url)),'public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const rooms=new Map();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode=()=>Array.from(randomBytes(6),n=>alphabet[n%alphabet.length]).join('');
const makeToken=()=>randomBytes(24).toString('hex');
const cleanName=v=>String(v??'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,24)||'لاعب';
const cleanCode=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
const answer=(res,body,status=200)=>{if(!res.writableEnded){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));}};
function getPlayer(data){const room=rooms.get(cleanCode(data.code)),token=String(data.token||'');if(!room)throw Error('الغرفة مش موجودة أو السيرفر اتعاد تشغيله');const seat=room.players.findIndex(p=>p&&p.token===token&&token.length>=20);if(seat<0)throw Error('مش متصل بالغرفة، ادخل من اللينك تاني');return {room,seat};}
function packet(room,seat){const now=Date.now();return {code:room.code,size:room.game.size,drops:room.game.drops,players:room.players.map((p,i)=>p?{name:p.name,online:now-p.seenAt<25000,seat:i}:null),game:room.game,you:seat,rematch:room.rematch.slice()};}
function resolveWaiters(room){for(const waiter of room.waiters){clearTimeout(waiter.timer);answer(waiter.res,{ok:true,version:room.version,room_state:packet(room,waiter.seat)});}room.waiters.clear();}
function publish(room){room.touched=Date.now();room.version++;resolveWaiters(room);}
async function requestBody(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>2000)throw Error('الطلب كبير قوي');}try{return JSON.parse(s||'{}')}catch{throw Error('بيانات الطلب مش صحيحة')}}
async function handleApi(req,res,path){
 const data=await requestBody(req);
 if(path==='/api/create_room'){
  if(rooms.size>4000)throw Error('السيرفر مشغول، جرّب تاني');
  const size=Number(data.size),drops=Number(data.drops);
  if(![5,7].includes(size)||![1,2].includes(drops))throw Error('إعدادات اللعبة غير صحيحة');
  let code;do{code=roomCode();}while(rooms.has(code));
  const token=makeToken(),now=Date.now();
  const room={code,players:[{name:cleanName(data.name),token,seenAt:now},null],game:newGame(size,drops),rematch:[false,false],touched:now,version:0,waiters:new Set()};
  rooms.set(code,room);publish(room);answer(res,{ok:true,code,token});return;
 }
 if(path==='/api/join_room'){
  const room=rooms.get(cleanCode(data.code));if(!room)throw Error('الغرفة مش موجودة أو السيرفر اتعاد تشغيله');
  let token=String(data.token??'');let seat=room.players.findIndex(p=>p&&p.token===token&&token.length>=20);
  if(seat===-1){seat=room.players.findIndex(p=>p===null);if(seat===-1)throw Error('الغرفة كاملة بالفعل');token=makeToken();room.players[seat]={name:cleanName(data.name),token,seenAt:Date.now()};}
  room.players[seat].seenAt=Date.now();publish(room);answer(res,{ok:true,code:room.code,token});return;
 }
 const {room,seat}=getPlayer(data);
 if(path==='/api/play'){
  if(!room.players[1])throw Error('مستنيين اللاعب التاني');
  room.game=apply(room.game,seat,data.action);room.rematch=[false,false];publish(room);answer(res,{ok:true});return;
 }
 if(path==='/api/rematch'){
  if(!room.players[1]||room.game.phase!=='done')throw Error('الماتش لسه مخلصش');
  room.rematch[seat]=true;
  if(room.rematch.every(Boolean)){room.game=newGame(room.game.size,room.game.drops,1-room.game.first);room.rematch=[false,false];}
  publish(room);answer(res,{ok:true});return;
 }
 if(path==='/api/poll'){
  const wasOnline=Date.now()-room.players[seat].seenAt<25000;
  room.players[seat].seenAt=Date.now();room.touched=Date.now();
  if(!wasOnline)publish(room);
  const since=Number(data.since);
  if(!Number.isInteger(since)||since!==room.version){answer(res,{ok:true,version:room.version,room_state:packet(room,seat)});return;}
  const waiter={res,seat,timer:null};room.waiters.add(waiter);
  waiter.timer=setTimeout(()=>{room.waiters.delete(waiter);answer(res,{ok:true,version:room.version,room_state:packet(room,seat)});},12000);
  req.on('close',()=>{if(res.writableEnded)return;clearTimeout(waiter.timer);room.waiters.delete(waiter);});
  return;
 }
 answer(res,{ok:false,error:'طلب غير معروف'},404);
}
const server=http.createServer(async(req,res)=>{
  let path;try{path=new URL(req.url,'http://localhost').pathname}catch{res.writeHead(400);res.end();return;}
  if(path==='/healthz'){answer(res,{ok:true,rooms:rooms.size});return;}
  if(path.startsWith('/api/')){
    if(req.method!=='POST'){answer(res,{ok:false,error:'POST only'},405);return;}
    try{await handleApi(req,res,path)}catch(e){answer(res,{ok:false,error:e.message||'حصلت مشكلة'},400)}return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let name;try{name=path==='/'?'index.html':decodeURIComponent(path).replace(/^\/+/, '');}catch{res.writeHead(400);res.end();return;}
  const safe=normalize(name);if(safe.startsWith('..')||safe.startsWith('/')||safe.includes('\0')){res.writeHead(403);res.end();return;}
  try{const body=await readFile(join(ROOT,safe));res.writeHead(200,{'content-type':mime[extname(safe)]||'application/octet-stream','cache-control':safe==='index.html'?'no-cache':'public, max-age=300','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}
});
setInterval(()=>{const deadline=Date.now()-24*60*60*1000;for(const [code,room] of rooms)if(room.touched<deadline){for(const w of room.waiters){clearTimeout(w.timer);answer(w.res,{ok:false,error:'الغرفة انتهت'});}rooms.delete(code);}},30*60*1000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Seega listening on ${PORT}`));
