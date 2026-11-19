/**
 * Consent-based WebRTC audio for one authenticated Seega match.
 * Firebase Cloud Functions transports signaling; all voice media stays P2P.
 * STUN-only is NOT global-quality calling: configure TURN before production.
 */
export function createLiveVoice({matchId,myUid,otherUid,signal,onIncoming=()=>{},onState=()=>{},onError=()=>{},iceServers}){
 if(!matchId||!myUid||!otherUid||myUid===otherUid||typeof signal!=='function')throw Error('Voice needs a real paired match');
 let pc=null,stream=null,audio=null,muted=false,accepted=false,requested=false,closed=false,candidates=[];
 let pendingIncoming=null;const seen=new Set();
 const config={iceServers:Array.isArray(iceServers)&&iceServers.length?iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
 async function outgoing(type,body={}){
  if(closed)return;
  return signal(matchId,otherUid,{type,...body});
 }
 function inform(status){onState({status,muted,connected:pc?.connectionState==='connected'});}
 async function mic(){
  if(stream)return stream;
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('المتصفح لا يدعم الميكروفون الآمن');
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  return stream;
 }
 async function peer(){
  if(pc)return pc;
  const local=await mic();
  const next=new RTCPeerConnection(config);pc=next;
  for(const track of local.getAudioTracks())next.addTrack(track,local);
  next.onicecandidate=e=>{if(e.candidate)outgoing('candidate',{candidate:e.candidate.toJSON()}).catch(onError);};
  next.ontrack=e=>{
   if(closed)return;
   if(!audio){
    audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;
    audio.setAttribute('aria-label','صوت منافس السيجا');audio.dataset.seegaSecureVoice='true';
    document.body.append(audio);
   }
   audio.srcObject=e.streams[0];audio.play().catch(()=>onError(Error('اضغط الشاشة لتشغيل صوت المنافس')));
  };
  next.onconnectionstatechange=()=>{
   if(next.connectionState==='failed')onError(Error('الاتصال الصوتي فشل؛ الشبكة قد تحتاج TURN'));
   inform(next.connectionState);
  };
  return next;
 }
 async function flushCandidates(){
  if(!pc?.remoteDescription)return;
  const pending=candidates.splice(0);
  for(const candidate of pending)try{await pc.addIceCandidate(new RTCIceCandidate(candidate));}catch(onError){}
 }
 async function receive(message){
  if(closed||message.fromUid!==otherUid||!message.payload)return;
  if(seen.has(message.id))return;
  seen.add(message.id);
  if(seen.size>400)seen.clear();
  const type=message.payload.type;
  if(type==='voice-request'){
   pendingIncoming=message;
   onIncoming(message);inform('incoming');return;
  }
  if(type==='voice-decline'||type==='voice-cancel'){
   requested=false;inform('declined');return;
  }
  if(type==='hangup'){close(false);return;}
  if(type==='voice-accept'){
   if(!requested)return; // user must have requested first
   accepted=true;
   try{
    const p=await peer();const offer=await p.createOffer();
    await p.setLocalDescription(offer);
    await outgoing('offer',{sdp:{type:p.localDescription.type,sdp:p.localDescription.sdp}});
    inform('connecting');
   }catch(e){onError(e);close(false);}
   return;
  }
  if(type==='offer'){
   if(!accepted)return; // only after user explicitly accepted
   try{
    const p=await peer();
    await p.setRemoteDescription(new RTCSessionDescription(message.payload.sdp));
    await flushCandidates();
    const answer=await p.createAnswer();await p.setLocalDescription(answer);
    await outgoing('answer',{sdp:{type:p.localDescription.type,sdp:p.localDescription.sdp}});
    inform('connecting');
   }catch(e){onError(e);close(false);}
   return;
  }
  if(type==='answer'){
   if(!requested||!pc)return;
   try{
    await pc.setRemoteDescription(new RTCSessionDescription(message.payload.sdp));
    await flushCandidates();
   }catch(onError){}
   return;
  }
  if(type==='candidate'){
   if(!accepted)return;
   const c=message.payload.candidate;
   if(!c||typeof c.candidate!=='string'||c.candidate.length>4000)return;
   if(pc?.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(c));}catch(onError){}}
   else candidates.push(c);
  }
 }
 async function request(){
  if(closed)throw Error('المكالمة اتقفلت');
  requested=true;
  await outgoing('voice-request');inform('outgoing');
 }
 async function accept(){
  if(!pendingIncoming||closed)throw Error('مفيش مكالمة متاحة');
  await mic(); // user gesture: browser permission prompt
  accepted=true;
  pendingIncoming=null;
  await outgoing('voice-accept');inform('connecting');
 }
 async function decline(){
  if(!pendingIncoming)return;
  pendingIncoming=null;await outgoing('voice-decline');inform('declined');
 }
 async function hangup(){if(!closed)await outgoing(requested&&!accepted?'voice-cancel':'hangup').catch(()=>{});close(false);}
 function mute(){
  muted=!muted;for(const track of stream?.getAudioTracks()||[])track.enabled=!muted;
  inform(pc?.connectionState||'muted');return muted;
 }
 function close(announce=true){
  if(closed)return;
  closed=true;requested=false;accepted=false;candidates=[];
  try{pc?.close();}catch{}pc=null;
  for(const track of stream?.getTracks()||[])track.stop();stream=null;
  if(audio){try{audio.pause();audio.srcObject=null;audio.remove();}catch{}audio=null;}
  if(announce)inform('closed');else inform('ended');
 }
 return {request,accept,decline,hangup,mute,close,receive,active:()=>!closed,hasStream:()=>!!stream};
}
