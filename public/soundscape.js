// Original procedurally synthesized ambient loop. No third-party recordings/copyrighted music.
let ac=null,interval=null,step=0;
const ctx=()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ac??=new C();if(ac.state==='suspended')ac.resume().catch(()=>{});return ac;};
function note(hz,duration=.22,vol=.045,type='sine',at=0){
 const c=ctx();if(!c)return;const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter();
 o.type=type;o.frequency.setValueAtTime(hz,t);filter.type='lowpass';filter.frequency.value=1200;
 g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
 o.connect(filter);filter.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+.05);
}
export function effect(type,enabled=true){if(!enabled)return;try{
 if(type==='capture'){note(410,.18,.12,'triangle');note(235,.3,.09,'sawtooth',.09);note(650,.15,.035,'sine',.22);}
 else if(type==='victory'){[392,494,587,784].forEach((n,i)=>note(n,.38,.085,'triangle',i*.13));}
 else if(type==='join'){[330,440,550].forEach((n,i)=>note(n,.18,.06,'sine',i*.1));}
 else if(type==='message'){note(780,.13,.037,'sine');note(1040,.15,.032,'sine',.09);}
 else if(type==='select'){note(480,.055,.026,'sine');}
 else if(type==='place'){note(240,.12,.07,'triangle');note(620,.07,.024,'sine',.025);}
 else {note(340,.10,.068,'triangle');note(460,.075,.04,'sine',.06);}
}catch(e){console.warn('Audio unavailable',e);}}
export function startMusic(){if(interval!==null)return;const scale=[196,246.94,293.66,329.63,392,440,493.88,587.33];step=0;interval=window.setInterval(()=>{if(document.hidden)return;const i=step++%16;const shift=Math.floor(step/16)%4;note(scale[(i*3+shift)%scale.length],.42,.022,'sine');if(i%4===0)note([98,110,130.81,87.31][shift],1.9,.025,'triangle');},390);}
export function stopMusic(){if(interval!==null)clearInterval(interval);interval=null;}
export function isMusicOn(){return interval!==null;}