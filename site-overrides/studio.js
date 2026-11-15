  // Separate full-screen avatar studio. It edits the same profile object used throughout Nama.
  let studioOriginalProfile = null;
  let studioDirty = false;
  const studioRoot = $('avatarPage');
  function studioRefresh(syncInputs=false){
    if(!studioRoot)return;
    const p=state.profile||defaults.profile;
    const studioDefaults={characterStyle:'masculine',hairStyle:'short',hairColor:'#302832',facialHair:'none',glasses:'none',outfitStyle:'tshirt',outfitColor:'#7568c8',pantsColor:'#29445f',skinTone:'#b97955'};
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
    const ageBand=namaAvatarAgeBand(p.age||26);
    studioRoot.querySelectorAll('[data-studio-age]').forEach(btn=>{
      const selected=namaAvatarAgeBand(Number(btn.dataset.studioAge))===ageBand;
      btn.classList.toggle('selected',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    });
    const gender=p.characterStyle==='feminine'?'feminine':'masculine';
    studioRoot.querySelectorAll('[data-studio-preset]').forEach(btn=>{
      const preset=btn.dataset.studioPreset;
      const selected=(gender==='feminine'&&((preset==='girl'&&ageBand==='teen')||(preset==='woman'&&ageBand==='young')||(preset==='seniorWoman'&&ageBand==='senior')))
        ||(gender==='masculine'&&((preset==='boy'&&ageBand==='teen')||(preset==='man'&&ageBand==='young')||(preset==='seniorMan'&&ageBand==='senior')));
      btn.classList.toggle('selected',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    });
    studioRoot.querySelectorAll('[data-outfit-gender]').forEach(btn=>{
      const allowed=btn.dataset.outfitGender==='both'||btn.dataset.outfitGender===gender;
      btn.hidden=!allowed;
    });
    studioRoot.querySelectorAll('[data-studio-gender]').forEach(el=>{
      el.hidden=el.dataset.studioGender!==gender;
    });
    $('studioAvatarCaption').textContent=namaAvatarAgeLabel(p.age||26)+' · '+(gender==='feminine'?'شخصية أنثوية':'شخصية رجالية')+' · '+(p.height||170)+' سم · '+(p.weight||70)+' كجم';
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
    drawAvatarInto('studioAvatarFigure');
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
    studioSetTab('identity');
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
    const p=state.profile;
    p[key]=value;
    if(key==='characterStyle'){
      if(value==='feminine'){
        if(!['hoodie','jacket','sport','blouse','cardigan','dress','abaya'].includes(p.outfitStyle))p.outfitStyle='hoodie';
        if(['bald','buzz'].includes(p.hairStyle))p.hairStyle='long';
        p.facialHair='none';
      }else{
        if(!['tshirt','hoodie','jacket','sport','polo','shirt'].includes(p.outfitStyle))p.outfitStyle='tshirt';
        if(p.hairStyle==='long')p.hairStyle='short';
        if(p.facialHair==='none'&&p.glasses==null)p.glasses='none';
      }
    }
    if(key==='age'&&Number(value)<18&&p.characterStyle==='feminine')p.facialHair='none';
    studioSetDirty();
    studioRefresh(false);
  }
  function studioApplyPreset(preset){
    const presets={
      girl:{gender:'feminine',age:16,outfit:'hoodie',hair:'long'},
      woman:{gender:'feminine',age:26,outfit:'hoodie',hair:'long'},
      seniorWoman:{gender:'feminine',age:65,outfit:'abaya',hair:'medium'},
      boy:{gender:'masculine',age:16,outfit:'hoodie',hair:'short'},
      man:{gender:'masculine',age:26,outfit:'tshirt',hair:'short'},
      seniorMan:{gender:'masculine',age:65,outfit:'jacket',hair:'short'}
    };
    const option=presets[preset];
    if(!option)return;
    state.profile.characterStyle=option.gender;
    state.profile.age=option.age;
    state.profile.outfitStyle=option.outfit;
    state.profile.hairStyle=option.hair;
    if(option.gender==='feminine')state.profile.facialHair='none';
    studioSetDirty();
    studioRefresh(true);
  }
  studioRoot.addEventListener('click',event=>{
    const tab=event.target.closest('[data-studio-tab]');
    if(tab){studioSetTab(tab.dataset.studioTab);return;}
    const preset=event.target.closest('[data-studio-preset]');
    if(preset){studioApplyPreset(preset.dataset.studioPreset);return;}
    const ageChoice=event.target.closest('[data-studio-age]');
    if(ageChoice){
      $('studioAge').value=ageChoice.dataset.studioAge;
      studioUpdateProfile('age',Number(ageChoice.dataset.studioAge));
      return;
    }
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
      if(target.id.startsWith('studioFace')||target.id==='studioAge')studioRefresh(false);
      else{
        $('studioAvatarCaption').textContent=namaAvatarAgeLabel(state.profile.age||26)+' · '+(state.profile.characterStyle==='feminine'?'شخصية أنثوية':'شخصية رجالية')+' · '+(state.profile.height||170)+' سم · '+(state.profile.weight||70)+' كجم';
        drawAvatarInto('studioAvatarFigure');
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
