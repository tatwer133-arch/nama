  // Separate full-screen avatar studio. It edits the same profile object used throughout Nama.
  let studioOriginalProfile = null;
  let studioDirty = false;
  const studioRoot = $('avatarPage');
  function studioHex(value,fallback){
    return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
  }
  function studioRenderRealisticAvatar(){
    const p=state.profile||defaults.profile;
    const skin=studioHex(p.skinTone,'#dca77e');
    const hair=studioHex(p.hairColor,'#302832');
    const outfit=studioHex(p.outfitColor,'#303138');
    const pants=studioHex(p.pantsColor,'#29445f');
    const hairStyle=p.hairStyle||'short';
    const facialHair=p.facialHair||'beard';
    const glasses=p.glasses||'none';
    const outfitStyle=p.outfitStyle||'tshirt';
    const hairShape='<path d="M91 59 C86 29 104 7 130 7 C158 6 176 27 173 55 L167 78 Q158 67 153 61 Q139 70 127 68 Q109 70 98 62 Z" fill="'+hair+'" opacity=".88"/>';
    let hairDetails='';
    if(hairStyle==='bald'){
      hairDetails='<path d="M94 57 C91 27 108 15 131 14 C153 14 168 30 169 56 Q161 78 151 84 Q132 91 111 82 Q99 74 94 57Z" fill="'+skin+'" opacity=".98"/>';
    }else if(hairStyle==='buzz'){
      hairDetails='<path d="M92 58 C91 27 108 11 131 10 C155 10 171 29 169 57 L162 67 Q150 57 132 59 Q110 61 97 65Z" fill="'+hair+'" opacity=".94"/>';
    }else if(hairStyle==='medium'||hairStyle==='long'){
      hairDetails='<path d="M95 48 Q89 75 96 104 Q99 110 104 104 L107 73Z M164 47 Q174 76 165 108 Q161 113 156 105 L155 72Z" fill="'+hair+'" opacity=".9"/>';
    }else if(hairStyle==='curly'){
      const curls=[[98,34,10],[110,19,12],[124,13,11],[139,15,12],[153,25,11],[164,40,9],[103,52,9],[154,53,9]];
      hairDetails=curls.map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+hair+'" opacity=".94"/>').join('');
    }else if(hairStyle==='wavy'){
      hairDetails='<path d="M91 53 Q94 22 116 17 Q128 12 139 20 Q155 15 169 38 L169 63 Q159 53 150 51 Q137 65 121 57 Q106 65 96 61Z" fill="'+hair+'" opacity=".9"/>';
    }else{
      hairDetails=hairShape;
    }

    const skinTint='<g style="mix-blend-mode:color" opacity=".54" fill="'+skin+'">'+
      '<path d="M102 34 Q111 20 131 21 Q154 22 162 43 L160 77 Q157 99 143 109 Q130 117 115 108 Q100 96 98 72Z"/>'+
      '<path d="M109 93 Q130 111 151 94 L153 122 Q144 137 130 137 Q114 133 106 119Z"/>'+
      '<path d="M76 157 Q82 151 91 159 Q88 188 86 220 Q85 253 91 276 Q87 290 77 282 Q68 265 69 239 Q69 199 76 157Z"/>'+
      '<path d="M171 158 Q180 151 187 160 Q194 199 192 240 Q191 269 181 285 Q170 290 167 276 Q175 245 173 215Z"/>'+
    '</g>';
    const shirtPath='M102 116 Q116 108 130 112 Q147 109 160 117 Q176 122 181 139 L190 163 L174 173 L166 150 L168 242 Q163 253 93 252 L91 171 L79 165 L77 140 Q85 122 102 116Z';
    const clothes='<g style="mix-blend-mode:color" opacity=".94"><path d="'+shirtPath+'" fill="'+outfit+'"/></g>'+
      '<path d="M102 116 Q115 109 130 112 Q148 109 160 117" fill="none" stroke="#f6f2ff" stroke-opacity=".56" stroke-width="2"/>'+
      '<path d="M96 248 Q130 256 165 248" fill="none" stroke="#f7f3ff" stroke-opacity=".24" stroke-width="2"/>';
    let garmentDetails='';
    if(outfitStyle==='hoodie'){
      garmentDetails='<path d="M105 119 Q105 99 130 96 Q155 99 156 119 L149 133 Q130 142 112 133Z" fill="'+outfit+'" stroke="#eee8ff" stroke-opacity=".45" stroke-width="2"/>'+
        '<path d="M122 131 L119 165 M138 131 L141 165" stroke="#f5f1ff" stroke-opacity=".76" stroke-width="2.4"/>'+
        '<path d="M105 211 Q130 222 155 211 L153 238 Q130 247 107 238Z" fill="'+outfit+'" fill-opacity=".35" stroke="#f3efff" stroke-opacity=".62" stroke-width="2"/>';
    }else if(outfitStyle==='jacket'){
      garmentDetails='<path d="M104 116 L121 131 L130 152 L139 131 L158 116" fill="none" stroke="#f6f1ff" stroke-width="3" stroke-opacity=".82"/>'+
        '<path d="M130 130 L130 248" stroke="#f5f0ff" stroke-width="2.4" stroke-opacity=".85"/>'+
        '<path d="M115 133 L124 149 L118 178 M145 133 L136 149 L142 178" fill="none" stroke="#1e2531" stroke-opacity=".7" stroke-width="3"/>';
    }else if(outfitStyle==='polo'){
      garmentDetails='<path d="M108 117 L128 135 L146 117 L139 144 L130 153 L118 144Z" fill="#f3efff" fill-opacity=".76" stroke="#38313d" stroke-opacity=".3" stroke-width="1.5"/>'+
        '<path d="M130 150 L130 190" stroke="#fff" stroke-opacity=".65" stroke-width="2.2"/>'+
        '<circle cx="130" cy="161" r="1.8" fill="#fff"/><circle cx="130" cy="174" r="1.8" fill="#fff"/>';
    }else if(outfitStyle==='shirt'){
      garmentDetails='<path d="M108 116 L128 137 L148 116 L141 151 L130 161 L118 151Z" fill="#f4efff" fill-opacity=".82" stroke="#34303b" stroke-opacity=".26" stroke-width="1.5"/>'+
        '<path d="M130 158 L130 246" stroke="#fff" stroke-opacity=".67" stroke-width="2"/>'+
        '<circle cx="130" cy="177" r="1.7" fill="#fff"/><circle cx="130" cy="196" r="1.7" fill="#fff"/><circle cx="130" cy="215" r="1.7" fill="#fff"/>';
    }else if(outfitStyle==='sport'){
      garmentDetails='<path d="M89 136 L100 139 L94 190 L83 187Z M171 139 L182 136 L188 187 L177 190Z" fill="#fff" fill-opacity=".82"/>'+
        '<path d="M102 118 Q130 127 158 118" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="3"/>';
    }
    const pantsTint='<g style="mix-blend-mode:color" opacity=".9" fill="'+pants+'">'+
      '<path d="M94 244 Q130 253 169 244 L174 272 L170 319 L167 365 L169 411 L177 460 L158 471 L145 457 L139 414 L134 365 L127 347 L120 390 L117 430 L112 469 L88 467 L83 455 L91 411 L93 364 L92 317Z"/>'+
    '</g>';
    let beardOverlay='';
    if(facialHair==='none'){
      beardOverlay='<path d="M105 82 Q115 102 130 107 Q147 102 155 82 L152 105 Q144 118 130 119 Q113 115 107 101Z" fill="'+skin+'" opacity=".98"/>';
    }else if(facialHair==='moustache'){
      beardOverlay='<path d="M106 91 Q114 106 130 109 Q147 106 154 91 L151 107 Q143 119 130 120 Q115 116 109 105Z" fill="'+skin+'" opacity=".98"/>';
    }else if(facialHair==='stubble'){
      beardOverlay='<path d="M105 84 Q114 102 130 107 Q147 102 155 84 L151 106 Q140 118 130 118 Q115 115 108 103Z" fill="#60443c" opacity=".2"/>';
    }
    let glassesOverlay='';
    if(glasses==='round'){
      glassesOverlay='<g fill="none" stroke="#29252d" stroke-width="3.1"><circle cx="115" cy="66" r="12"/><circle cx="147" cy="66" r="12"/><path d="M127 65 Q131 62 135 65 M103 63 L98 61 M159 63 L165 61"/></g>';
    }else if(glasses==='square'){
      glassesOverlay='<g fill="none" stroke="#29252d" stroke-width="3.3" stroke-linejoin="round"><rect x="102" y="54" width="26" height="22" rx="6"/><rect x="135" y="54" width="26" height="22" rx="6"/><path d="M128 63 Q131 60 135 63 M102 62 L96 60 M161 62 L167 60"/></g>';
    }
    const image=$('studioAvatarImage');
    const outfitAssets={tshirt:'./avatar-realistic.webp',hoodie:'./avatar-hoodie.webp',jacket:'./avatar-jacket.webp'};
    if(image){
      image.src=outfitAssets[outfitStyle]||outfitAssets.tshirt;
      image.alt=({tshirt:'تيشيرت',hoodie:'هودي',jacket:'جاكيت'}[outfitStyle]||'ملابس')+' — أفاتار نَما';
    }
    $('studioAvatarEffects').innerHTML=hairDetails+beardOverlay+glassesOverlay;
    const art=$('studioAvatar');
    if(art){art.dataset.hair=hairStyle;art.dataset.outfit=outfitStyle;art.dataset.body=p.bodyShape||'average';}
  }

  function studioRefresh(syncInputs=false){
    if(!studioRoot)return;
    const p=state.profile||defaults.profile;
    const studioDefaults={hairStyle:'short',hairColor:'#302832',facialHair:'beard',glasses:'none',outfitStyle:'tshirt',outfitColor:'#303138',pantsColor:'#29445f',skinTone:'#dca77e'};
    Object.entries(studioDefaults).forEach(([key,value])=>{if(!p[key])p[key]=value;});
    if(syncInputs){
      $('studioHeight').value=p.height||170;
      $('studioWeight').value=p.weight||70;
      $('studioAge').value=p.age||'';
      $('studioOccupation').value=p.occupation||'';
      $('studioActivity').value=p.activity||'moderate';
      $('studioFaceZoom').value=p.faceZoom??1.45;
      $('studioFaceX').value=p.faceOffsetX??0;
      $('studioFaceY').value=p.faceOffsetY??-7;
    }
    studioRoot.querySelectorAll('[data-studio-field]').forEach(btn=>{
      const key=btn.dataset.studioField;
      const active=String(p[key]??'')===String(btn.dataset.value);
      btn.classList.toggle('selected',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
    });
    const thumb=$('studioPhotoThumb');
    thumb.replaceChildren();
    if(p.avatarPhoto){
      const img=document.createElement('img');
      img.src=p.avatarPhoto;
      img.alt='صورتك المختارة';
      thumb.appendChild(img);
      $('studioRemovePhotoBtn').hidden=false;
    }else{
      thumb.textContent='＋';
      $('studioRemovePhotoBtn').hidden=true;
    }
    $('studioFaceZoomValue').textContent=(Number(p.faceZoom??1.45)).toFixed(2)+'×';
    $('studioFaceXValue').textContent=String(Number(p.faceOffsetX??0));
    $('studioFaceYValue').textContent=String(Number(p.faceOffsetY??-7));
    $('studioAvatarCaption').textContent=(p.height||170)+' سم · '+(p.weight||70)+' كجم · '+(p.avatarPhoto?'صورتك مضافة':'شخصية قابلة للتخصيص');
    studioRenderRealisticAvatar();
  }
  function studioSetDirty(){
    studioDirty=true;
    const saveBtn=$('studioSaveBtn');
    if(saveBtn)saveBtn.textContent='حفظ التغييرات　✓';
  }
  function studioSetTab(tab){
    studioRoot.querySelectorAll('[data-studio-tab]').forEach(btn=>{
      const active=btn.dataset.studioTab===tab;
      btn.classList.toggle('selected',active);
      btn.setAttribute('aria-current',active?'location':'false');
    });
    const target=$('studioPanel'+tab.charAt(0).toUpperCase()+tab.slice(1));
    const options=$('studioOptions');
    if(target&&options){
      if(window.matchMedia&&window.matchMedia('(max-width: 820px)').matches){
        target.scrollIntoView({behavior:'smooth',block:'start'});
      }else{
        const top=target.getBoundingClientRect().top-options.getBoundingClientRect().top+options.scrollTop-58;
        options.scrollTo({top:Math.max(0,top),behavior:'smooth'});
      }
    }
  }
  function openAvatarStudio(){
    studioOriginalProfile=clone(state.profile);
    studioDirty=false;
    studioRefresh(true);
    showPage('avatarPage');
    studioSetTab('photo');
  }
  function closeAvatarStudio(){
    if(studioDirty&&!confirm('فيه تعديلات لسه ما اتحفظتش. تحب تخرج من غير حفظ؟'))return;
    if(studioDirty&&studioOriginalProfile){
      state.profile=clone(studioOriginalProfile);
      renderAvatar();
      renderSettings();
    }
    studioDirty=false;
    showPage('settingsPage');
  }
  function studioUpdateProfile(key,value){
    state.profile[key]=value;
    studioSetDirty();
    studioRefresh(false);
  }
  studioRoot.addEventListener('click',event=>{
    const tab=event.target.closest('[data-studio-tab]');
    if(tab){studioSetTab(tab.dataset.studioTab);return;}
    const choice=event.target.closest('[data-studio-field]');
    if(choice){
      let value=choice.dataset.value;
      if(value==='true')value=true;
      else if(value==='false')value=false;
      studioUpdateProfile(choice.dataset.studioField,value);
    }
  });
  studioRoot.addEventListener('input',event=>{
    const target=event.target;
    const map={studioHeight:['height',120,230],studioWeight:['weight',25,300],studioAge:['age',13,100],studioFaceZoom:['faceZoom',1,2],studioFaceX:['faceOffsetX',-28,28],studioFaceY:['faceOffsetY',-28,28]};
    const item=map[target.id];
    if(item){
      const number=Number(target.value);
      if(!Number.isFinite(number)||number<item[1]||number>item[2])return;
      state.profile[item[0]]=number;
      studioSetDirty();
      if(target.id.startsWith('studioFace'))studioRefresh(false);
      else{
        $('studioAvatarCaption').textContent=(state.profile.height||170)+' سم · '+(state.profile.weight||70)+' كجم · '+(state.profile.avatarPhoto?'صورتك مضافة':'شخصية قابلة للتخصيص');
        studioRenderRealisticAvatar();
      }
      if(target.id==='studioFaceZoom')$('studioFaceZoomValue').textContent=number.toFixed(2)+'×';
      if(target.id==='studioFaceX')$('studioFaceXValue').textContent=String(number);
      if(target.id==='studioFaceY')$('studioFaceYValue').textContent=String(number);
      return;
    }
    if(target.id==='studioOccupation'){
      state.profile.occupation=target.value.slice(0,60);
      studioSetDirty();
    }else if(target.id==='studioActivity'){
      state.profile.activity=target.value;
      studioSetDirty();
    }
  });
  $('studioAvatarPhotoInput').addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(file.size>12*1024*1024){toast('الصورة كبيرة. اختار صورة أقل من 12 ميجابايت.');return;}
    try{
      const data=await compressAvatarPhoto(file);
      state.profile.avatarPhoto=data;
      if(state.profile.faceZoom==null)state.profile.faceZoom=1.45;
      studioSetDirty();
      studioRefresh(false);
      toast('صورتك ظهرت في معاينة الأفاتار');
    }catch{
      toast('مقدرناش نقرأ الصورة. جرّب صورة JPG أو PNG تانية.');
    }
  });
  $('studioRemovePhotoBtn').addEventListener('click',()=>{
    if(!state.profile.avatarPhoto)return;
    state.profile.avatarPhoto='';
    studioSetDirty();
    studioRefresh(false);
    toast('اتشالت الصورة من المعاينة');
  });
  $('studioResetBtn').addEventListener('click',()=>{
    if(!confirm('ترجع شكل الأفاتار للإعدادات الافتراضية؟'))return;
    const old=state.profile;
    state.profile={...clone(defaults.profile),age:old.age,height:old.height,weight:old.weight,occupation:old.occupation,activity:old.activity};
    studioSetDirty();
    studioRefresh(true);
    toast('رجّعنا شكل الأفاتار الافتراضي');
  });
  $('studioBackBtn').addEventListener('click',closeAvatarStudio);
  $('studioSaveBtn').addEventListener('click',()=>{
    const height=Number($('studioHeight').value),weight=Number($('studioWeight').value),age=$('studioAge').value.trim()===''?'':Number($('studioAge').value);
    if(!Number.isFinite(height)||height<120||height>230){toast('راجع الطول: لازم يكون من 120 إلى 230 سم');$('studioHeight').focus();return;}
    if(!Number.isFinite(weight)||weight<25||weight>300){toast('راجع الوزن: لازم يكون من 25 إلى 300 كجم');$('studioWeight').focus();return;}
    if(age!==''&&(!Number.isFinite(age)||age<13||age>100)){toast('راجع السن: لازم يكون من 13 إلى 100 سنة');$('studioAge').focus();return;}
    state.profile.height=height;
    state.profile.weight=weight;
    state.profile.age=age;
    state.profile.occupation=$('studioOccupation').value.trim().slice(0,60);
    state.profile.activity=$('studioActivity').value;
    save();
    renderAvatar();
    renderSettings();
    studioOriginalProfile=clone(state.profile);
    studioDirty=false;
    toast('اتحفظ شكل الأفاتار وباقي إعداداتك بنجاح 💜');
  });
  $('openAvatarStudioBtn').addEventListener('click',openAvatarStudio);
