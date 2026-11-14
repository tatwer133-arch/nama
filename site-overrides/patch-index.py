#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: patch-index.py PUBLIC_DIRECTORY')

public = Path(sys.argv[1])
index = public / 'index.html'
html = index.read_text(encoding='utf-8')

def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one {label} match, found {count}')
    return source.replace(old, new, 1)

html = replace_once(html, '<link rel="manifest" href="/manifest.json" />', '<link rel="manifest" href="./manifest.json" />', 'manifest link')
html = replace_once(html, '<link rel="icon" href="/icon.svg" type="image/svg+xml" />', '<link rel="icon" href="./icon.svg" type="image/svg+xml" />', 'icon link')
html = replace_once(html, 'title="اتكلم وهو هيكتب">🎙️</button>', 'title="اتكلم وهو هيكتب؛ ولو المتصفح مش بيدعم المايك استخدم مايك لوحة المفاتيح" aria-pressed="false">🎙️</button>', 'microphone button title')
html = replace_once(html, '<span id="chatStatus" class="avatar-mini-note">', '<span id="chatStatus" class="avatar-mini-note" aria-live="polite">', 'chat status aria-live')

old_speech = '''  function startChatDictation(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){toast('الإملاء الصوتي مش مدعوم في المتصفح ده. جرّب لوحة مفاتيح الموبايل الصوتية.');return;}
    if(chatRecognition){chatRecognition.stop();chatRecognition=null;$('chatMicBtn').classList.remove('listening');return;}
    const rec=new Recognition();chatRecognition=rec;rec.lang='ar-EG';rec.interimResults=true;rec.continuous=false;$('chatMicBtn').classList.add('listening');$('chatStatus').textContent='سامعك… اتكلم دلوقتي';
    rec.onresult=e=>{let transcript='';for(let i=e.resultIndex;i<e.results.length;i++)transcript+=e.results[i][0].transcript;$('chatInput').value=transcript;};
    rec.onerror=()=>{$('chatStatus').textContent='مش قادر أسمعك بوضوح';};
    rec.onend=()=>{$('chatMicBtn').classList.remove('listening');$('chatStatus').textContent='راجع الكلام واضغط إرسال';chatRecognition=null;};rec.start();
  }
'''
new_speech = '''  function speechErrorMessage(code){
    const messages={
      'not-allowed':'اسمح للموقع باستخدام الميكروفون من إعدادات الموقع في المتصفح، ثم جرّب مرة تانية.',
      'service-not-allowed':'المتصفح منع خدمة تحويل الصوت لنص. افتح نَما في Google Chrome واسمح بالميكروفون.',
      'audio-capture':'مش لاقي ميكروفون متاح. اتأكد إن الميكروفون مش مستخدم في تطبيق تاني.',
      'network':'تحويل الصوت لنص محتاج إنترنت. اتأكد من الاتصال وجرب تاني.',
      'no-speech':'ما وصلنيش كلام. قرّب الموبايل واتكلم بعد ما يبدأ الاستماع.',
      'language-not-supported':'التعرف على العربية غير متاح في خدمة المتصفح الحالية. جرّب Google Chrome.',
      'bad-grammar':'خدمة التعرف على الكلام واجهت مشكلة. جرّب تاني.',
      'aborted':'تم إيقاف التسجيل.'
    };
    return messages[code]||'حصلت مشكلة أثناء استخدام الميكروفون. راجع صلاحيات الميكروفون وجرب تاني.';
  }
  function focusKeyboardDictationFallback(){
    const input=$('chatInput');
    input.focus({preventScroll:false});
    $('chatStatus').textContent='استخدم زر المايك في لوحة مفاتيح الموبايل علشان يتحول كلامك لكتابة.';
    toast('المتصفح ده لا يدعم المايك المباشر داخل الموقع. فتحت خانة الكتابة؛ اضغط علامة المايك في لوحة مفاتيح الموبايل.');
  }
  function startChatDictation(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){focusKeyboardDictationFallback();return;}
    if(chatRecognition){
      const activeRecognition=chatRecognition;
      chatRecognition=null;
      activeRecognition.__namaStopRequested=true;
      $('chatMicBtn').classList.remove('listening');
      $('chatMicBtn').setAttribute('aria-pressed','false');
      $('chatStatus').textContent='تم إيقاف التسجيل.';
      try{activeRecognition.stop();}catch{}
      return;
    }
    let rec;
    try{rec=new Recognition();}catch{focusKeyboardDictationFallback();return;}
    const input=$('chatInput');
    const originalText=String(input.value||'').trim();
    let hasTranscript=false;
    let speechError='';
    chatRecognition=rec;
    rec.lang='ar-EG';
    rec.interimResults=true;
    rec.continuous=false;
    rec.maxAlternatives=1;
    $('chatMicBtn').classList.add('listening');
    $('chatMicBtn').setAttribute('aria-pressed','true');
    $('chatStatus').textContent='سامعك… اتكلم دلوقتي';
    $('chatError').hidden=true;
    rec.onstart=()=>{$('chatStatus').textContent='سامعك… اتكلم دلوقتي';};
    rec.onresult=event=>{
      let transcript='';
      for(let i=0;i<event.results.length;i++){
        const result=event.results[i];
        const part=result?.[0]?.transcript||'';
        transcript+=part+' ';
      }
      transcript=transcript.trim();
      if(transcript){
        hasTranscript=true;
        input.value=[originalText,transcript].filter(Boolean).join(originalText?' ':'');
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
    };
    rec.onerror=event=>{
      speechError=event?.error||'unknown';
      if(speechError!=='aborted')$('chatStatus').textContent=speechErrorMessage(speechError);
    };
    rec.onend=()=>{
      $('chatMicBtn').classList.remove('listening');
      $('chatMicBtn').setAttribute('aria-pressed','false');
      if(chatRecognition===rec)chatRecognition=null;
      if(rec.__namaStopRequested){
        $('chatStatus').textContent='تم إيقاف التسجيل.';
      }else if(hasTranscript){
        $('chatStatus').textContent='الكلام اتحوّل لنص. راجعه واضغط إرسال.';
      }else if(speechError){
        $('chatStatus').textContent=speechErrorMessage(speechError);
      }else{
        $('chatStatus').textContent='لم ألتقط كلامًا. اضغط المايك وجرب تتكلم تاني.';
      }
    };
    try{rec.start();}
    catch(error){
      if(chatRecognition===rec)chatRecognition=null;
      $('chatMicBtn').classList.remove('listening');
      $('chatMicBtn').setAttribute('aria-pressed','false');
      const code=error?.name==='NotAllowedError'?'not-allowed':error?.name==='InvalidStateError'?'aborted':'unknown';
      $('chatStatus').textContent=speechErrorMessage(code);
    }
  }
'''
html = replace_once(html, old_speech, new_speech, 'speech recognition implementation')
html = replace_once(html, "if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));", "if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',()=>{const appBase=new URL('./',location.href);navigator.serviceWorker.register(new URL('sw.js',appBase),{scope:appBase.pathname,updateViaCache:'none'}).catch(error=>console.warn('Nama offline support could not be enabled:',error));});", 'service worker registration')
html = html.replace("    outing:{title:'خروجة أو وقت بره',icon:'🌳',desc:'غيّر جوك واعمل حاجة بتحبها',unit:'مرة',goal:1,step:1},\n    outing:{title:'خروجة أو وقت بره',icon:'🌳',desc:'غيّر جوك واعمل حاجة بتحبها',unit:'مرة',goal:1,step:1},", "    outing:{title:'خروجة أو وقت بره',icon:'🌳',desc:'غيّر جوك واعمل حاجة بتحبها',unit:'مرة',goal:1,step:1},")
index.write_text(html, encoding='utf-8')
print('Applied microphone and GitHub Pages subpath fixes.')
