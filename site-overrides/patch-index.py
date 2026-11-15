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
# Attach the modular avatar studio to the existing app while keeping the uploaded source archive unchanged.
overrides_dir = Path(__file__).parent
studio_html = (overrides_dir / "studio.html").read_text(encoding="utf-8")
studio_css = (overrides_dir / "studio.css").read_text(encoding="utf-8")
studio_js = (overrides_dir / "studio.js").read_text(encoding="utf-8")
avatar_runtime = (overrides_dir / "avatar-runtime.js").read_text(encoding="utf-8")
avatar_function_marker = "  function avatarMarkup(targetId='avatarFigure') {" + chr(10) + "    const p=state.profile||defaults.profile;"
html = replace_once(html, avatar_function_marker, avatar_runtime + chr(10) + avatar_function_marker, "shared realistic avatar runtime")
html = replace_once(html, avatar_function_marker, avatar_function_marker + chr(10) + "    return namaRealisticAvatarMarkup(p,targetId);", "use realistic avatar by default")
avatar_viewbox = 'viewBox="0 0 220 300"'
if html.count(avatar_viewbox) != 6:
    raise SystemExit(f"Expected six avatar viewBoxes, found {html.count(avatar_viewbox)}")
html = html.replace(avatar_viewbox, 'viewBox="0 0 320 640"')
draw_avatar_old = "  function drawAvatarInto(id){ const el=$(id); if(el) el.innerHTML=avatarMarkup(id); }"
draw_avatar_new = "  function drawAvatarInto(id){ const el=$(id); if(el){ const p=state.profile||defaults.profile; el.innerHTML=id==='studioAvatarFigure'?namaRealisticAvatarLayers(p,id):avatarMarkup(id); } }"
html = replace_once(html, draw_avatar_old, draw_avatar_new, "render realistic avatar in editor")



html = replace_once(
    html,
    "const mass=clamp(1+(bmi-22)*.027,.78,1.34);",
    "const bodyShapeFactor=p.bodyShape==='slim'?.91:p.bodyShape==='broad'?1.10:1;" + chr(10) + "    const mass=clamp((1+(bmi-22)*.027)*bodyShapeFactor,.72,1.42);",
    "body shape rendering"
)
html = replace_once(
    html,
    '<button class="secondary-btn" id="editProfileBtn">تعديل بيانات الأفاتار وقص الصورة</button>',
    '<button class="primary-btn" id="openAvatarStudioBtn" type="button">✨ تخصيص شكل الأفاتار</button>' + chr(10) + '        <button class="secondary-btn" id="editProfileBtn">تعديل بيانات الأفاتار وقص الصورة والبيانات الأساسية</button>',
    "avatar studio settings entry"
)
html = replace_once(html, "</style>", studio_css + chr(10) + "  </style>", "avatar studio styles")
html = replace_once(html, "</main>", studio_html + chr(10) + "  </main>", "dedicated avatar page")

show_page_old = '''  function showPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
    if (id==='progressPage') renderProgress();
    if (id==='settingsPage') renderSettings();
    if (id==='coachPage') { syncCoachForm(); drawAvatarInto('coachAvatarFigure'); drawAvatarInto('chatAvatarFigure'); renderCoachPlan(); renderChatMessages(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }
'''
show_page_new = '''  function showPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
    const studioMode=id==='avatarPage';
    document.querySelector('.app')?.classList.toggle('studio-expanded',studioMode);
    document.querySelector('.app-wrap')?.classList.toggle('studio-expanded',studioMode);
    if (id==='progressPage') renderProgress();
    if (id==='settingsPage') renderSettings();
    if (id==='avatarPage') studioRefresh(true);
    if (id==='coachPage') { syncCoachForm(); drawAvatarInto('coachAvatarFigure'); drawAvatarInto('chatAvatarFigure'); renderCoachPlan(); renderChatMessages(); }
    window.scrollTo({top:0,behavior:'smooth'});
  }
'''
html = replace_once(html, show_page_old, show_page_new, "page navigation integration")
script_end = html.rfind("})();")
if script_end < 0:
    raise SystemExit("Application closure not found.")
html = html[:script_end] + chr(10) + studio_js + chr(10) + html[script_end:]

index.write_text(html, encoding='utf-8')
print('Applied microphone and GitHub Pages subpath fixes.')
