function namaRealisticAvatarLayers(p, targetId) {
  const uid = String(targetId || 'avatar').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeColor = (v, d) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d;
  const skin = safeColor(p.skinTone, '#dca77e');
  const hair = safeColor(p.hairColor, '#302832');
  const shirt = safeColor(p.outfitColor, '#7568c8');
  const pants = safeColor(p.pantsColor, '#29445f');
  const style = p.outfitStyle || 'tshirt';
  const hairStyle = p.hairStyle || 'short';
  const beard = p.facialHair || 'beard';
  const glasses = p.glasses || 'none';
  const hairPath = 'M281 111 Q274 56 321 21 Q365 -6 414 23 Q463 53 461 111 L444 127 Q432 90 409 75 Q379 96 340 79 Q314 81 294 120Z';
  const shirtPath = 'M320 260 Q344 252 374 252 Q411 251 444 262 L520 289 Q570 301 588 354 L610 457 Q611 480 585 490 L548 475 L548 712 Q380 741 230 712 L232 475 L196 490 Q167 490 160 467 L184 354 Q202 300 252 287Z';
  const pantsPath = 'M230 708 Q305 726 379 721 L380 785 L360 1058 L354 1382 Q346 1444 300 1444 L269 1405 L248 1193 L232 956Z M382 721 Q458 727 530 708 L529 956 L510 1193 L489 1405 Q474 1444 428 1444 L422 1382 L416 1058 L396 785Z';
  let out = '<image href="./avatar-realistic.webp" x="0" y="0" width="760" height="1560" preserveAspectRatio="none"/>';
  if (p.avatarPhoto) {
    const photo = String(p.avatarPhoto).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    out += '<defs><clipPath id="nama-face-' + uid + '"><path d="M287 104 Q291 69 330 58 Q379 39 425 68 Q462 91 457 151 L447 194 Q434 241 380 253 Q328 247 306 211 Q287 176 287 104Z"/></clipPath></defs>';
    out += '<image href="' + photo + '" x="281" y="52" width="180" height="205" preserveAspectRatio="xMidYMid slice" clip-path="url(#nama-face-' + uid + ')"/>';
  }
  out += '<defs><clipPath id="nama-skin-' + uid + '"><path d="M287 104 Q291 69 330 58 Q379 39 425 68 Q462 91 457 151 L447 194 Q434 241 380 253 Q328 247 306 211 Q287 176 287 104Z"/><path d="M158 470 Q184 474 229 465 L209 830 Q193 872 162 842 Q140 820 146 759Z"/><path d="M548 465 Q587 480 611 457 L622 759 Q626 820 601 842 Q570 872 554 830Z"/></clipPath></defs>';
  out += '<rect x="130" y="20" width="510" height="860" fill="' + skin + '" opacity=".12" clip-path="url(#nama-skin-' + uid + ')" style="mix-blend-mode:color"/>';
  out += '<path d="' + shirtPath + '" fill="' + shirt + '" opacity=".56" style="mix-blend-mode:color"/>';
  out += '<path d="' + pantsPath + '" fill="' + pants + '" opacity=".46" style="mix-blend-mode:color"/>';
  if (style === 'hoodie') {
    out += '<path d="M315 299 Q310 245 378 233 Q446 245 441 299 L422 337 Q379 365 335 337Z" fill="' + shirt + '" stroke="#f4efff" stroke-opacity=".62" stroke-width="5"/>';
    out += '<path d="M342 307 L352 454 M413 307 L403 454" stroke="#f4efff" stroke-width="6" stroke-linecap="round" opacity=".82"/>';
    out += '<path d="M265 565 Q379 603 493 565 L472 662 Q379 697 286 662Z" fill="' + shirt + '" fill-opacity=".34" stroke="#f4efff" stroke-opacity=".45" stroke-width="4"/>';
  } else if (style === 'jacket') {
    out += '<path d="M315 270 L363 293 L380 357 L399 293 L446 270 L488 303 L455 410 L437 383 L443 715 L318 715 L324 383 L305 410 L273 303Z" fill="' + shirt + '" fill-opacity=".34" stroke="#f4efff" stroke-opacity=".72" stroke-width="5"/>';
    out += '<path d="M380 355 L380 707 M364 293 L380 355 L347 407 M399 293 L380 355 L413 407" fill="none" stroke="#f4efff" stroke-width="7" stroke-opacity=".78"/>';
  } else if (style === 'polo' || style === 'shirt') {
    out += '<path d="M331 267 L380 315 L429 267 L412 337 L380 360 L348 337Z" fill="#f4efff" fill-opacity=".82" stroke="#3d3659" stroke-opacity=".3" stroke-width="3"/>';
    out += '<path d="M380 355 L380 705" stroke="#f4efff" stroke-width="4" opacity=".64"/>';
    if (style === 'shirt') out += '<circle cx="380" cy="392" r="3" fill="#f4efff"/><circle cx="380" cy="430" r="3" fill="#f4efff"/><circle cx="380" cy="468" r="3" fill="#f4efff"/>';
    else out += '<circle cx="380" cy="385" r="3" fill="#f4efff"/><circle cx="380" cy="412" r="3" fill="#f4efff"/>';
  } else if (style === 'sport') {
    out += '<path d="M230 312 L265 323 L247 424 L214 414Z M530 323 L565 312 L581 414 L548 424Z" fill="#f4efff" fill-opacity=".8"/>';
    out += '<path d="M280 286 Q380 315 480 286" fill="none" stroke="#f4efff" stroke-width="8" opacity=".8"/>';
  }
  out += '<path d="' + hairPath + '" fill="' + hair + '" opacity=".32" style="mix-blend-mode:color"/>';
  if (hairStyle === 'bald') out += '<path d="' + hairPath + '" fill="' + skin + '" opacity=".98"/>';
  else if (hairStyle === 'curly') out += '<g fill="' + hair + '" opacity=".95"><circle cx="297" cy="62" r="23"/><circle cx="321" cy="31" r="24"/><circle cx="352" cy="16" r="22"/><circle cx="385" cy="17" r="23"/><circle cx="420" cy="35" r="22"/><circle cx="445" cy="69" r="20"/></g>';
  else if (hairStyle === 'wavy') out += '<path d="M282 106 Q283 46 329 30 Q350 14 373 24 Q400 9 426 34 Q458 57 457 108 Q437 83 418 82 Q393 99 371 77 Q342 97 319 78 Q301 85 282 106Z" fill="' + hair + '" opacity=".94"/>';
  else if (hairStyle === 'medium' || hairStyle === 'long') out += '<path d="M290 85 Q274 145 292 216 L318 224 L322 150 L314 93Z M444 85 Q467 145 449 216 L423 224 L420 150 L427 92Z" fill="' + hair + '" opacity=".93"/>';
  if (beard === 'none') out += '<path d="M305 180 Q325 218 379 226 Q431 218 444 179 L438 211 Q421 247 380 253 Q332 247 310 215Z" fill="' + skin + '" opacity=".98"/>';
  else if (beard === 'moustache') {
    out += '<path d="M305 180 Q325 218 379 226 Q431 218 444 179 L438 211 Q421 247 380 253 Q332 247 310 215Z" fill="' + skin + '" opacity=".98"/>';
    out += '<path d="M347 177 Q360 166 376 177 Q392 166 408 177 Q398 194 380 189 Q362 194 347 177Z" fill="' + hair + '" opacity=".95"/>';
  } else if (beard === 'stubble') out += '<path d="M306 181 Q326 221 379 229 Q430 219 443 180 L437 211 Q418 246 380 250 Q337 246 312 215Z" fill="' + hair + '" opacity=".22"/>';
  if (glasses === 'round') out += '<g fill="none" stroke="#29252d" stroke-width="7" stroke-linecap="round"><circle cx="337" cy="135" r="31"/><circle cx="419" cy="135" r="31"/><path d="M368 133 Q378 125 388 133 M306 130 L288 123 M450 130 L469 123"/></g>';
  else if (glasses === 'square') out += '<g fill="none" stroke="#29252d" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"><rect x="301" y="105" width="68" height="56" rx="15"/><rect x="388" y="105" width="68" height="56" rx="15"/><path d="M369 128 Q378 122 388 128 M301 126 L281 120 M456 126 L474 120"/></g>';
  else if (glasses === 'sunglasses') out += '<g fill="#182536" stroke="#252631" stroke-width="6"><path d="M302 111 Q333 101 367 111 L363 151 Q357 167 333 162 Q308 157 302 111Z"/><path d="M389 111 Q423 101 455 111 L455 151 Q449 167 425 162 Q401 157 389 111Z"/><path d="M367 126H389"/></g>';
  return out;
}

function namaRealisticAvatarMarkup(p, targetId) {
  const bodyShape = p.bodyShape === 'slim' ? 0.94 : p.bodyShape === 'broad' ? 1.06 : 1;
  const scale = 300 / 1560;
  const width = 760 * scale;
  const offset = (220 - width) / 2;
  return '<g transform="translate(' + offset + ' 0) scale(' + scale + ') translate(' + ((1-bodyShape)*380) + ' 0) scale(' + bodyShape + ' 1)">' + namaRealisticAvatarLayers(p, targetId) + '</g>';
}