/**
 * Seega Royale — SERVER-ONLY match state machine. STAGING / NOT DEPLOYED.
 * Commands must be authenticated on the server and committed with a
 * SERIALIZABLE datastore transaction, including all wallet/ledger entries.
 * Amounts are hundredths of non-redeemable, in-game coins.
 */
const requireState=(yes,message)=>{if(!yes)throw Error(message)};
const person=uid=>({uid,ready:false,connected:true,disconnectedAt:null});
const player=(m,uid)=>m.players.find(p=>p?.uid===uid);
const copy=m=>JSON.parse(JSON.stringify(m));
export function createMatch({id,hostUid,mode,type,stakeMinor=0,commissionBps=500,turnMs=30000,graceMs=15000}){
 requireState(typeof hostUid==='string'&&hostUid.length>0&&id&&mode,'Invalid identity');
 requireState(['quick','private','bot','local'].includes(type),'Invalid type');
 requireState(Number.isSafeInteger(stakeMinor)&&stakeMinor>=0,'Invalid stake');
 requireState(type==='quick'||stakeMinor===0,'Private games cannot wager');
 requireState(Number.isInteger(commissionBps)&&commissionBps>=0&&commissionBps<=10000,'Invalid commission');
 return {id,mode,type,stakeMinor,commissionBps,turnMs,graceMs,
  ownerUid:hostUid,players:[person(hostUid),null],invites:[],status:'waiting',
  game:null,deadline:null,escrowRef:null,escrowCommitted:false,settlement:null,
  commandIds:[],version:1};
}
export function findQuick(queue,{mode,stakeMinor,uid}){
 return queue.find(m=>m.type==='quick'&&m.status==='waiting'&&!m.players[1]&&m.mode===mode&&m.stakeMinor===stakeMinor&&m.ownerUid!==uid)||null;
}
export function payout(m,winner){
 requireState(m.type==='quick'&&m.escrowCommitted&&m.players[1],'Escrow not committed');
 const pot=2*m.stakeMinor,fee=Math.floor(pot*m.commissionBps/10000);
 if(winner==='draw'){
  const first=Math.floor(fee/2);
  return {potMinor:pot,commissionMinor:fee,credits:[{uid:m.players[0].uid,amountMinor:m.stakeMinor-first},{uid:m.players[1].uid,amountMinor:m.stakeMinor-(fee-first)}]};
 }
 requireState(m.players.some(p=>p?.uid===winner),'Invalid winner');
 return {potMinor:pot,commissionMinor:fee,credits:[{uid:winner,amountMinor:pot-fee}]};
}
export function transition(original,cmd,{now=Date.now(),engine}={}){
 const m=copy(original),events=[],uid=cmd.actorUid;
 const server=['escrow-ok','escrow-failed','auto-move','disconnect-timeout'].includes(cmd.type);
 requireState(server?cmd.fromServer===true:player(m,uid)||cmd.type==='accept'||cmd.type==='quick-join','Unauthorized command');
 if(cmd.id&&m.commandIds.includes(cmd.id))return {match:original,events:[],duplicate:true};
 const waiting=()=>requireState(m.status==='waiting','Room already started');
 const prestart=()=>requireState(['waiting','pending_escrow'].includes(m.status),'Match already started');
 const host=()=>requireState(uid===m.ownerUid,'Host only');
 const readyReset=()=>m.players.filter(Boolean).forEach(p=>p.ready=false);
 const cancelPending=()=>{if(m.status==='pending_escrow'){
  events.push({kind:'cancel-pending-escrow-atomically',key:m.escrowRef});
  m.status='waiting';m.escrowRef=null;readyReset();}};
 const start=()=>{requireState(engine?.init,'Missing server game engine');m.game=engine.init(m.mode);m.status='playing';m.deadline=now+m.turnMs;events.push({kind:'start'});};
 const finish=(winner,reason)=>{requireState(['playing','reconnecting'].includes(m.status),'Match not in play');
  m.status='finished';m.deadline=null;m.settlement={winner,reason};
  if(m.stakeMinor){requireState(m.escrowCommitted,'Escrow missing');events.push({kind:'settle-once',key:'settle:'+m.id,plan:payout(m,winner)});}
  events.push({kind:'finished',winner,reason});};
 switch(cmd.type){
 case 'quick-join':
  waiting();requireState(m.type==='quick'&&!m.players[1]&&cmd.mode===m.mode&&cmd.stakeMinor===m.stakeMinor&&uid!==m.ownerUid,'Queue mismatch');
  m.players[1]=person(uid);events.push({kind:'joined',uid});break;
 case 'invite':
  waiting();host();requireState(m.type==='private'&&cmd.friendUid&&cmd.friendUid!==uid,'Invalid invitation');
  if(!m.invites.some(i=>i.uid===cmd.friendUid))m.invites.push({uid:cmd.friendUid,status:'pending'});
  events.push({kind:'invite',uid:cmd.friendUid});break;
 case 'accept':
  waiting();requireState(m.type==='private'&&!m.players[1]&&m.invites.some(i=>i.uid===uid&&i.status==='pending'),'Room full or invitation expired');
  m.players[1]=person(uid);m.invites.forEach(i=>i.status=i.uid===uid?'accepted':'cancelled');events.push({kind:'joined',uid});break;
 case 'kick':
  prestart();host();requireState(m.players[1],'No opponent');cancelPending();
  events.push({kind:'kick',uid:m.players[1].uid});m.players[1]=null;readyReset();break;
 case 'ready':
  waiting();requireState(m.players[1]&&player(m,uid),'Waiting for opponent');player(m,uid).ready=!!cmd.ready;
  if(m.players.every(p=>p?.ready)){
   if(m.type==='quick'){m.status='pending_escrow';m.escrowRef='escrow:'+m.id;
    events.push({kind:'reserve-both-atomically',key:m.escrowRef,stakeMinor:m.stakeMinor,players:m.players.map(p=>p.uid)});}
   else start();
  }events.push({kind:'ready',uid,ready:player(m,uid).ready});break;
 case 'escrow-ok':
  requireState(m.status==='pending_escrow'&&cmd.ref===m.escrowRef,'Uncommitted or invalid escrow');
  m.escrowCommitted=true;start();break;
 case 'escrow-failed':
  requireState(m.status==='pending_escrow','No escrow pending');m.status='waiting';m.escrowRef=null;readyReset();events.push({kind:'escrow-failed'});break;
 case 'leave':
  if(['waiting','pending_escrow'].includes(m.status)){cancelPending();
   if(uid===m.ownerUid){m.status='cancelled';m.invites.forEach(i=>i.status='cancelled');}
   else {m.players[1]=null;readyReset();}
   events.push({kind:'left-without-penalty',uid});
  }else {const other=m.players.find(p=>p&&p.uid!==uid);requireState(other,'Missing rival');finish(other.uid,'forfeit');}break;
 case 'disconnect':
  requireState(['waiting','playing','reconnecting'].includes(m.status),'Closed match');
  player(m,uid).connected=false;player(m,uid).disconnectedAt=now;
  if(m.status==='playing')m.status='reconnecting';
  events.push({kind:'disconnect',uid,until:now+m.graceMs});break;
 case 'reconnect':
  requireState(['waiting','playing','reconnecting'].includes(m.status),'Closed match');
  player(m,uid).connected=true;player(m,uid).disconnectedAt=null;
  if(m.status==='reconnecting'&&m.players.every(p=>p?.connected)){m.status='playing';m.deadline=now+m.turnMs;}
  events.push({kind:'reconnect',uid});break;
 case 'disconnect-timeout':{
  requireState(m.status==='reconnecting','Not disconnected');
  const gone=m.players.filter(p=>p&&!p.connected&&now>=p.disconnectedAt+m.graceMs);
  requireState(gone.length,'Grace is not over');
  finish(gone.length===2?'draw':m.players.find(p=>p.uid!==gone[0].uid).uid,'disconnect-forfeit');break;
 }
 case 'move':case 'auto-move':{
  requireState(m.status==='playing'&&engine?.apply&&engine?.legal,'No active server game');
  const turn=m.game.turn;let action=cmd.action;
  if(cmd.type==='move'){requireState(m.players[turn]?.uid===uid,'Not your turn');requireState(now<=m.deadline,'Turn expired');}
  else {requireState(now>=m.deadline,'Turn not expired');
   const legal=engine.legal(m.game,turn);requireState(legal.length,'No legal move');
   action=engine.auto?engine.auto(m.game,turn,legal):legal[0];
   requireState(legal.some(a=>a.kind===action.kind&&a.to===action.to&&a.from===action.from),'Illegal auto move');
  }
  const applied=engine.apply(m.game,turn,action);requireState(applied?.ok&&applied.game,'Illegal move');
  m.game=applied.game;m.deadline=now+m.turnMs;events.push({kind:cmd.type,action});
  if(m.game.winner!==null&&m.game.winner!==undefined)finish(m.game.winner==='draw'?'draw':m.players[m.game.winner].uid,'rules');
  break;
 }
 default:throw Error('Unknown command');
 }
 if(cmd.id){requireState(typeof cmd.id==='string'&&cmd.id.length>=8,'Invalid command id');
  m.commandIds.push(cmd.id);if(m.commandIds.length>100)m.commandIds.shift();}
 m.version++;return {match:m,events:events.map(x=>({...x,version:m.version})),duplicate:false};
}
/** No browser may satisfy this interface; only a verified server backend. */
export function requireBackend(storage){
 requireState(storage&&typeof storage.transaction==='function'&&typeof storage.verifyIdentity==='function'&&typeof storage.uniqueLedger==='function','Authenticated ACID backend required');
 return true;
}
