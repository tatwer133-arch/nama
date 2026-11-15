function namaAvatarAgeBand(age){
  const n=Number(age);
  if(!Number.isFinite(n)||n<18)return 'teen';
  if(n<40)return 'young';
  if(n<60)return 'mature';
  return 'senior';
}
function namaAvatarAgeLabel(age){
  const band=namaAvatarAgeBand(age);
  return band==='teen'?'مراهق':band==='young'?'شاب':band==='mature'?'ناضج':'كبير في السن';
}
function namaAvatarSafeColor(value,fallback){
  return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
}
function namaAvatarEscape(value){
  return String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function namaRealisticAvatarLayers(p,targetId='avatar'){
  p=p||{};
  const gender=p.characterStyle==='feminine'?'feminine':'masculine';
  const ageBand=namaAvatarAgeBand(p.age||25);
  const hair=namaAvatarSafeColor(p.hairColor,ageBand==='senior'?'#a6a4a1':'#302832');
  const outfit=namaAvatarSafeColor(p.outfitColor,gender==='feminine'?'#8d70df':'#303138');
  const pants=namaAvatarSafeColor(p.pantsColor,'#29445f');
  const style=p.outfitStyle||(gender==='feminine'?'hoodie':'tshirt');
  const glasses=p.glasses||((ageBand==='senior')?'round':'none');
  const faceId='nama-face-'+String(targetId).replace(/[^a-zA-Z0-9_-]/g,'');
  const bodyShape=p.bodyShape==='slim'?.94:p.bodyShape==='broad'?1.07:1;
  const h=Number(p.height)||170;
  const w=Number(p.weight)||70;
  const bmi=w/Math.pow(h/100,2);
  const widthFactor=Math.max(.88,Math.min(1.12,1+(bmi-22)*.012))*bodyShape;
  const heightFactor=Math.max(.94,Math.min(1.06,h/170));
  const youth=ageBand==='teen'?.94:ageBand==='senior'?.99:1;
  const scaleX=widthFactor*youth;
  const scaleY=heightFactor*(ageBand==='teen'?.95:1);
  const tx=(320-320*scaleX)/2;
  const ty=(640-640*scaleY);
  let bodySrc;
  if(gender==='feminine'){
    bodySrc='./avatar-female.webp';
  }else{
    const maleStyle=['hoodie','jacket'].includes(style)?style:'tshirt';
    bodySrc='./avatar-male-'+maleStyle+'.webp';
  }
  let out='<g transform="translate('+tx.toFixed(2)+' '+ty.toFixed(2)+') scale('+scaleX.toFixed(3)+' '+scaleY.toFixed(3)+')">';
  out+='<image href="'+bodySrc+'" x="0" y="0" width="320" height="640" preserveAspectRatio="none"/>';
  // Recolor clothing and jeans without replacing the generated fabric texture.
  if(gender==='feminine'){
    const topPath='M58 126 Q82 108 119 112 Q163 101 205 116 Q246 129 260 177 L260 296 Q161 319 61 295 L59 180Z';
    out+='<defs><clipPath id="'+faceId+'-top"><path d="'+topPath+'"/></clipPath><clipPath id="'+faceId+'-hair"><path d="M42 158 Q17 94 61 30 Q104 -15 169 2 Q247 12 277 93 Q287 132 267 168 Q242 128 216 100 Q170 67 129 106 Q81 147 42 158Z"/></clipPath></defs>';
    out+='<path d="'+topPath+'" fill="'+outfit+'" opacity=".23" style="mix-blend-mode:color"/>';
    const jeansPath='M48 286 Q160 308 274 286 L261 550 Q211 594 166 589 Q105 594 58 550Z';
    out+='<path d="'+jeansPath+'" fill="'+pants+'" opacity=".17" style="mix-blend-mode:color"/>';
    if(style==='dress'){
      out+='<path d="M76 245 Q160 270 244 245 L275 520 Q160 570 45 520Z" fill="'+outfit+'" fill-opacity=".88" stroke="#fff" stroke-opacity=".65" stroke-width="3"/><path d="M160 266 L160 530" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>';
    }else if(style==='abaya'){
      out+='<path d="M68 130 Q160 105 252 130 L283 550 Q160 590 37 550Z" fill="'+outfit+'" fill-opacity=".79" stroke="#f4efff" stroke-opacity=".65" stroke-width="3"/><path d="M160 145 L160 548" stroke="#fff" stroke-opacity=".48" stroke-width="3"/>';
    }else if(style==='cardigan'){
      out+='<path d="M75 125 L112 142 L128 292 L80 300 L53 160Z M245 125 L208 142 L192 292 L240 300 L267 160Z" fill="'+outfit+'" fill-opacity=".48" stroke="#fff" stroke-opacity=".68" stroke-width="3"/><path d="M160 140 L160 291" stroke="#fff" stroke-opacity=".65" stroke-width="2"/>';
    }else if(style==='blouse'){
      out+='<path d="M124 116 L160 150 L196 116 L183 165 L160 180 L137 165Z" fill="#f5f0ff" fill-opacity=".84"/><path d="M160 180 L160 285" stroke="#fff" stroke-opacity=".56" stroke-width="2"/>';
    }else if(style==='jacket'){
      out+='<path d="M89 123 L131 145 L160 182 L189 145 L231 123 L253 164 L227 300 L93 300 L67 164Z" fill="'+outfit+'" fill-opacity=".3" stroke="#f8f4ff" stroke-opacity=".75" stroke-width="3"/><path d="M160 178 L160 295" stroke="#fff" stroke-width="3" stroke-opacity=".8"/>';
    }else if(style==='sport'){
      out+='<path d="M66 146 L82 150 L69 215 L55 211Z M254 150 L270 146 L281 211 L267 215Z" fill="#fff" fill-opacity=".72"/><path d="M90 126 Q160 146 230 126" fill="none" stroke="#fff" stroke-width="5" opacity=".68"/>';
    }
    out+='<path d="M80 6 Q160 -14 235 15 Q270 54 270 104" fill="none" stroke="'+hair+'" stroke-width="5" opacity=".22"/>';
    if(ageBand==='mature'||ageBand==='senior'){
      out+='<path d="M44 152 Q20 92 65 27 Q108 -13 169 2 Q247 12 277 93 Q287 132 267 168 Q242 128 216 100 Q170 67 129 106 Q81 147 44 152Z" fill="'+(ageBand==='senior'?'#b9b6b1':'#9b8f83')+'" opacity="'+(ageBand==='senior'?'.76':'.36')+'" style="mix-blend-mode:color" clip-path="url(#'+faceId+'-hair)"/>';
      if(ageBand==='senior'){
        out+='<path d="M111 100 Q124 96 137 100 M184 100 Q198 96 211 100 M117 119 Q130 123 141 119 M181 119 Q194 123 205 119" fill="none" stroke="#a58e83" stroke-width="2" stroke-linecap="round" opacity=".56"/>';
        out+='<path d="M127 143 Q160 153 193 143" fill="none" stroke="#a58e83" stroke-width="2" stroke-linecap="round" opacity=".5"/>';
      }
    }
  }else{
    const shirtPath='M79 114 Q105 96 143 102 Q180 96 214 112 L262 143 L246 294 L73 294 L58 143Z';
    const pantsPath='M73 286 Q160 307 247 286 L244 590 L190 610 L163 610 L160 468 L150 610 L118 610 L80 590Z';
    out+='<defs><clipPath id="'+faceId+'-shirt"><path d="'+shirtPath+'"/></clipPath><clipPath id="'+faceId+'-pants"><path d="'+pantsPath+'"/></clipPath><clipPath id="'+faceId+'-hair"><path d="M91 75 Q88 19 132 5 Q183 -7 218 28 Q240 53 225 101 Q205 76 184 68 Q151 85 123 70 Q106 72 91 93Z"/></clipPath></defs>';
    out+='<path d="'+shirtPath+'" fill="'+outfit+'" opacity=".25" style="mix-blend-mode:color"/>';
    out+='<path d="'+pantsPath+'" fill="'+pants+'" opacity=".18" style="mix-blend-mode:color"/>';
    if(style==='polo'){
      out+='<path d="M123 107 L160 143 L197 107 L187 160 L160 179 L133 160Z" fill="#f6f2ff" fill-opacity=".86"/><path d="M160 178 L160 287" stroke="#fff" stroke-width="2" opacity=".68"/>';
    }else if(style==='shirt'){
      out+='<path d="M121 106 L160 146 L199 106 L187 162 L160 185 L133 162Z" fill="#f6f2ff" fill-opacity=".9"/><path d="M160 183 L160 291" stroke="#fff" stroke-width="2" opacity=".65"/>';
    }else if(style==='sport'){
      out+='<path d="M63 144 L82 150 L72 212 L54 208Z M238 150 L257 144 L268 208 L250 212Z" fill="#fff" fill-opacity=".7"/>';
    }
    if(ageBand==='mature'||ageBand==='senior'){
      out+='<path d="M91 75 Q88 19 132 5 Q183 -7 218 28 Q240 53 225 101 Q205 76 184 68 Q151 85 123 70 Q106 72 91 93Z" fill="'+(ageBand==='senior'?'#c5c3c0':'#a49b8c')+'" opacity="'+(ageBand==='senior'?'.8':'.43')+'" style="mix-blend-mode:color" clip-path="url(#'+faceId+'-hair)"/>';
      out+='<path d="M107 119 Q123 123 137 119 M183 119 Q197 123 212 119" stroke="#927a70" stroke-width="2" stroke-linecap="round" opacity="'+(ageBand==='senior'?'.6':'.25')+'" fill="none"/>';
      if(ageBand==='senior'){
        out+='<path d="M117 135 Q131 141 144 135 M177 135 Q190 141 203 135 M128 154 Q160 166 192 154" stroke="#91776d" stroke-width="2" stroke-linecap="round" opacity=".48" fill="none"/>';
        out+='<path d="M111 102 Q160 92 211 102" stroke="#c4c1be" stroke-width="2.6" opacity=".55" fill="none"/>';
      }
    }
  }
  // For teens and seniors, reuse the already-created matching portrait to age the face.
  // A personal photo always takes priority over the generated age portrait.
  let portraitSrc='';
  if(!p.avatarPhoto){
    if(ageBand==='teen')portraitSrc=gender==='feminine'?'./portrait-girl.webp':'./portrait-boy.webp';
    else if(ageBand==='senior')portraitSrc=gender==='feminine'?'./portrait-woman-senior.webp':'./portrait-man-senior.webp';
  }
  if(p.avatarPhoto||portraitSrc){
    const faceX=gender==='feminine'?99:101;
    const faceY=gender==='feminine'?0:0;
    const faceW=gender==='feminine'?122:118;
    const faceH=gender==='feminine'?130:124;
    const photo=p.avatarPhoto?namaAvatarEscape(p.avatarPhoto):portraitSrc;
    out+='<defs><clipPath id="'+faceId+'-photo"><ellipse cx="'+(faceX+faceW/2)+'" cy="'+(faceY+faceH/2)+'" rx="'+(faceW/2)+'" ry="'+(faceH/2)+'"/></clipPath></defs>';
    out+='<image href="'+photo+'" x="'+faceX+'" y="'+faceY+'" width="'+faceW+'" height="'+faceH+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+faceId+'-photo)"/>';
  }
  // Add glasses above the face; the options update instantly on all app screens.
  if(glasses==='round'||glasses==='square'||glasses==='sunglasses'){
    const y=gender==='feminine'?91:83;
    const stroke=glasses==='sunglasses'?'#172333':'#2c2830';
    const fill=glasses==='sunglasses'?'#172333':'none';
    const shape=glasses==='round'
      ?'<circle cx="132" cy="'+y+'" r="20"/><circle cx="187" cy="'+y+'" r="20"/>'
      :'<rect x="111" y="'+(y-17)+'" width="43" height="34" rx="'+(glasses==='square'?8:15)+'"/><rect x="165" y="'+(y-17)+'" width="43" height="34" rx="'+(glasses==='square'?8:15)+'"/>';
    out+='<g fill="'+fill+'" fill-opacity="'+(glasses==='sunglasses'?'.92':'0')+'" stroke="'+stroke+'" stroke-width="4"><path d="'+(gender==='feminine'?'M152 ':'M154 ') + (y-1)+' Q160 '+(y-6)+' 165 '+(y-1)+'" fill="none"/>'+shape+'</g>';
  }
  if(ageBand==='senior'){
    out+='<g stroke="#7f6a61" stroke-width="1.8" stroke-linecap="round" opacity=".5" fill="none"><path d="'+(gender==='feminine'?'M106 112 Q118 108 128 112 M192 112 Q204 108 214 112':'M115 105 Q126 101 138 105 M182 105 Q194 101 206 105')+'"/></g>';
  }
  out+='</g>';
  return out;
}
function namaRealisticAvatarMarkup(p,targetId='avatar'){
  return namaRealisticAvatarLayers(p,targetId);
}