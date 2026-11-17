// Original procedural Egyptian-inspired ambient score; no external audio files.
// WebAudio requires a user gesture on many mobile browsers. unlockAudio() is called on pointerdown.
let audio=null,musicTimer=null,nextTime=0,beat=0;
let master=null,musicBus=null,fxBus=null;
let isUnlocked=false;
function ensureAudio(){
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return null;
 if(!audio){
  audio=new Context();master=audio.createGain();master.gain.value=.8;master.connect(audio.destination);
  musicBus=audio.createGain();musicBus.gain.value=.38;musicBus.connect(master);
  fxBus=audio.createGain();fxBus.gain.value=.9;fxBus.connect(master);
 }
 return audio;
}
export function unlockAudio(){
 try{const a=ensureAudio();if(!a)return false;
  if(a.state==='suspended')a.resume().catch(()=>{});
  isUnlocked=true;
  return true;
 }catch{return false;}
}
function tone(hz,when,duration,level=.12,shape='sine',target='fx',endHz=hz){
 const a=ensureAudio();if(!a)return;
 const o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
 o.type=shape;o.frequency.setValueAtTime(Math.max(15,hz),when);
 if(endHz!==hz)o.frequency.exponentialRampToValueAtTime(Math.max(15,endHz),when+duration);
 f.type='lowpass';f.frequency.value=shape==='sawtooth'?950:2100;
 g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,level),when+.015);
 g.gain.exponentialRampToValueAtTime(.0001,when+duration);
 o.connect(f);f.connect(g);g.connect(target==='music'?musicBus:fxBus);
 o.start(when);o.stop(when+duration+.015);
}
function percussion(when,frequency=190,vol=.14){
 const a=ensureAudio();if(!a)return;
 const len=Math.floor(a.sampleRate*.12),buf=a.createBuffer(1,len,a.sampleRate),data=buf.getChannelData(0);
 for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
 const b=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();b.buffer=buf;f.type='bandpass';f.frequency.value=frequency;f.Q.value=.72;
 g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+.12);
 b.connect(f);f.connect(g);g.connect(musicBus);b.start(when);
}
export function effect(kind,enabled=true){if(!enabled||!unlockAudio())return;
 try{
  const at=audio.currentTime+.012;
  switch(kind){
   case 'capture':tone(375,at,.22,.23,'triangle','fx',100);tone(820,at+.12,.19,.12,'sine');break;
   case 'victory':[392,494,587,784,988].forEach((f,i)=>tone(f,at+i*.14,.32,.19,'triangle'));break;
   case 'join':[440,550,660].forEach((f,i)=>tone(f,at+i*.1,.18,.15));break;
   case 'message':tone(840,at,.09,.1);tone(1120,at+.095,.12,.085);break;
   case 'select':tone(490,at,.07,.082,'sine');break;
   case 'place':tone(300,at,.13,.19,'triangle','fx',165);tone(670,at+.04,.11,.085);break;
   default:tone(360,at,.12,.13,'triangle','fx',230);tone(520,at+.08,.095,.06);break;
  }
 }catch(e){console.warn('Audio effect',e);}
}
const maqam=[196,233.08,261.63,293.66,349.23,392,466.16,523.25];
const melody=[0,2,4,5,4,2,0,2,3,5,7,5,4,3,2,0,0,2,4,7,6,4,3,2,0,3,5,4,2,1,0,-1];
function schedule(){if(!musicTimer||!audio||audio.state!=='running'||document.hidden)return;
 // schedule notes ahead: mobile browsers may suspend timers while the audio engine keeps playing.
 const secondsPerBeat=.4;
 while(nextTime<audio.currentTime+.55){
  const i=beat%32,degree=melody[i];
  if(degree>=0){const freq=maqam[degree]||196;
   tone(freq,nextTime,.29,i%8===0?.19:.135,'triangle','music');
   if(i%2===0)tone(freq/2,nextTime,.63,.075,'sine','music');
  }
  if(i%4===0){tone([98,116.54,130.81,87.31][Math.floor(i/8)],nextTime,1.3,.12,'sine','music');percussion(nextTime+.015,130,.1);}
  if(i%4===2)percussion(nextTime+.012,580,.055);
  beat++;nextTime+=secondsPerBeat;
 }
}
export function startMusic(){
 if(musicTimer!==null)return;
 if(!unlockAudio())return;
 const a=ensureAudio();nextTime=a.currentTime+.03;beat=0;
 musicTimer=window.setInterval(schedule,120);schedule();
}
export function stopMusic(){if(musicTimer!==null)clearInterval(musicTimer);musicTimer=null;}
export function isMusicOn(){return musicTimer!==null;}
window.addEventListener('pagehide',stopMusic);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&musicTimer!==null){unlockAudio();nextTime=Math.max(nextTime,audio?.currentTime||0)+.04;}});