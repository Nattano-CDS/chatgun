/* Structural port of NEAR v91 (98bb83e), near.tsx/person,
 * profile-view.tsx and upload-photos.tsx. Rendering only: all data access,
 * authorization, quota, CSRF and persistence remain in social.js/server APIs.
 * No provider identities or private media URLs are created here. */
window.ChatgunNearComponents = (() => {
  const icon = (name, size=19) => {
    const svg=window.ChatgunNearIcons[name];
    if(!svg)throw new Error('Unknown canonical icon');
    return svg.replace('width="19"',`width="${size}"`).replace('height="19"',`height="${size}"`);
  };
  const brand = (title,extra='') => `<div class="page-header-identity ${extra}"><a class="toolbar-brand" href="/" aria-label="ChatGun"><img src="/logo.svg" alt="">ChatGun</a><strong>${title}</strong></div>`;
  const badge = (person,size=19) => Number(person.identity_verified)===1 ? `<button class="verify-badge" type="button" data-badge-info aria-label="ดูความหมายตรายืนยัน" title="ผ่านการตรวจหลักฐานตัวตน · ไม่ใช่การรับรองพฤติกรรม">${icon('badge',size)}</button>` : '';
  const action = (name, id, text, c, extra = '') => `<button class="${c || ''}" data-action="${name}" data-user="${id}" ${extra}>${text}</button>`;
  function card({person:p,id,relation,incoming,context,html:h,portrait,distance,star,userPlus,canRate,rateDisabled,own=false,demo=false,messagingEnabled=false}) {
    const body = `<article class="person photo-card person-card" data-person="${h(id)}">
      <a class="card-open" href="/app/people/${encodeURIComponent(id)}" data-person-open="${h(id)}" aria-label="เปิดโปรไฟล์ ${h(p.name)}"></a>
      <div class="card-photo">${portrait(p,false)}</div><div class="photo-shade"></div>
      ${own ? '<span class="self-card-badge">คุณ</span>' : `<span class="card-distance">${icon('pin',14)}${h(distance)}</span>`}
      <div class="person-details"><div class="person-top"></div>
        <div class="card-name-row"><span class="person-name">${h(p.name)}</span>${!own&&Number(p.identity_verified)===1?'<span class="verify-badge" role="img" aria-label="ผ่านการตรวจหลักฐานตัวตน · ไม่ใช่การรับรองพฤติกรรม">'+icon('badge',19)+'</span>':''}</div>
        <p class="person-bio">${h(p.bio || 'ยินดีที่ได้รู้จัก')}</p>
        <div class="rating-line">${!own&&canRate?star:''}${own ? (demo?'โปรไฟล์ของคุณ · ตัวอย่าง':'โปรไฟล์ของคุณ') : p.rating_count ? Number(p.rating).toFixed(1) : 'ยังไม่มีคะแนน'}</div>
      </div></article>`;
    return body;
  }
  function peopleActions(c, block=false){
    if(c.own)return '';
    const id=c.html(c.id);
    return '<div class="people-management"><span class="safety-actions">'+action('report',id,icon('flag',15)+'รายงานผู้ใช้','')+(block?action('block',id,'บล็อกผู้ใช้',''):'')+'</span></div>';
  }
  function primary(c,size=19){
    return !c.own&&c.config.messagingEnabled?action('chat',c.html(c.id),icon('chat',size)+'แชท','primary'):'';
  }
  function privateAlbum(c){
    const h=c.html;
    const button=(a,label,request)=>'<button data-album-action="'+a+'" data-owner="'+h(c.id)+'" data-request="'+h(request?.id||'')+'" data-revision="'+Number(request?.revision||0)+'">'+label+'</button>';
    if(c.own)return c.privateAlbumOpen?'<section class="album-management" aria-label="จัดการสิทธิ์อัลบั้มส่วนตัว"><h2 class="album-heading">จัดการสิทธิ์</h2>'+(c.albumRequests||[]).map(r=>'<div class="album-access-row"><strong>'+h(r.requester_name)+'</strong><span>'+h({pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธแล้ว',revoked:'เพิกถอนแล้ว',cancelled:'ยกเลิกแล้ว'}[r.status])+'</span>'+(r.status==='approved'?button('revoke','เพิกถอนสิทธิ์',r):r.status==='pending'?button('approve','อนุมัติ',r)+button('reject','ปฏิเสธ',r):'')+'</div>').join('')+'</section>':'';
    return '';
  }
  // Lucide image / lock / lock-open paths (ISC); identical photo in both states.
  function albumIconButton(c){
    const unlocked=c.own||!!c.album?.granted,pending=c.album?.request?.status==='pending';
    const label=unlocked?(c.own?'เปิดอัลบั้มส่วนตัวและจัดการสิทธิ์':'เปิดอัลบั้มส่วนตัวที่ได้รับอนุมัติ'):pending?'ส่งคำขอแล้ว รออนุมัติอัลบั้มส่วนตัว':'ขอดูอัลบั้มส่วนตัว';
    const svg=body=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
    return '<button type="button" class="private-album-icon" data-private-album data-album-state="'+(unlocked?'unlocked':'locked')+'" aria-label="'+label+'" title="'+label+'" '+(pending||c.albumLoading||c.galleryLoadError?'disabled':'')+'><span class="album-icon-art">'+svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>')+'<span class="album-lock-badge">'+svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="'+(unlocked?'M7 11V7a5 5 0 0 1 9.9-1':'M7 11V7a5 5 0 0 1 10 0v4')+'"/>')+'</span></span></button>';
  }
  const chips = c => String(c.person.interests||'').split(',').map(i=>i.trim()).filter(Boolean).map(i=>`<span>${c.html(i)}</span>`).join('');
  const score = (c,gallery=false) => c.person.rating_count ? `${Number(c.person.rating).toFixed(1)}${gallery?' ★':''} · ${Number(c.person.rating_count)} คะแนน` : 'ยังไม่มีคะแนน';
  function profile(c) {
    const p=c.person,h=c.html;
    return `<main class="full-profile profile-route" aria-label="โปรไฟล์ ${h(p.name)}"><h1 class="sr-only">โปรไฟล์ ${h(p.name)}</h1>
      <div class="full-profile-image">${c.portrait(p,false)}</div><div class="full-profile-shade"></div>
      <button class="profile-back" data-close-profile aria-label="กลับ">${icon('back',24)}</button>
      ${brand('โปรไฟล์','profile-page-brand')}
      <div class="full-profile-info"><div class="full-name-row"><h1>${h(p.name)}</h1>${badge(p,25)}</div>
        <p class="full-bio">${h(p.bio||'ยังไม่ได้เขียน Bio')}</p>
        <div class="profile-facts"><span>${h(p.gender||'ไม่ระบุเพศ')}</span>${p.distance!=null?`<span>${icon('pin',15)}${h(c.distance)}</span>`:''}<span>${c.star}${score(c)}</span></div>
        <div class="profile-interests">${chips(c)}</div>
        <div class="full-profile-actions">${primary(c)}<button class="profile-gallery-button" data-profile-gallery>${c.grid}Gallery <span>${c.photos.filter(p=>p.visibility==='public').length}</span></button>${albumIconButton(c)}${c.canRate ? action('rate',h(c.id),c.star,'profile-rate',`aria-label="ให้คะแนน" ${c.rateDisabled?'disabled':''}`):''}</div>
        ${peopleActions(c,true)}${c.demo?'<span class="fixture-label">บุคคลสมมติ · เฉพาะเบราว์เซอร์</span>':''}
      </div></main>`;
  }
  function albumTiles(c,photos){const h=c.html;return `<div class="ig-grid">${photos.map((photo,i)=>`<div class="ig-tile"><button data-gallery-action="view" data-user="${h(c.id)}" data-photo="${h(photo.id)}" aria-label="ดูรูป ${h(photo.caption||i+1)}"><img src="${h(c.media(photo.id))}" alt="${h(photo.caption||'รูป Gallery')}" loading="lazy"><span class="tile-likes">${icon('heart',12)}${Number(photo.like_count||0)}</span></button>${c.own?`<button data-photo-visibility="${photo.visibility==='public'?'private':'public'}" data-photo="${h(photo.id)}">${photo.visibility==='public'?'ย้ายเป็นส่วนตัว':'เผยแพร่สาธารณะ'}</button><button class="delete-photo" data-gallery-action="delete" data-photo="${h(photo.id)}" aria-label="ลบรูป">${icon('trash',15)}</button>`:''}</div>`).join('')}</div>`;}
  function gallery(c) {
    const p=c.person,h=c.html;
    return `<main class="full-profile profile-route gallery-page" aria-label="Gallery ${h(p.name)}">
      <header class="gallery-header"><button class="gallery-back" data-profile-return aria-label="กลับไปโปรไฟล์">${icon('back',23)}</button>${brand('Gallery')}<button class="gallery-back" data-close-profile aria-label="ปิด Gallery">${icon('close',22)}</button></header>
      <div class="gallery-summary"><div class="gallery-avatar">${c.portrait(p,false)}</div><div><h2>${h(p.name)}${badge(p)}</h2><span>${c.photos.length} รูป · ${score(c,true)}</span><p>${h(p.bio||'ยังไม่ได้เขียน Bio')}</p>
      <div class="gallery-facts"><span>${h(p.gender||'ไม่ระบุเพศ')}</span>${p.distance!=null?`<span>${icon('pin',14)}${h(c.distance)}</span>`:''}<span>${c.own?'โปรไฟล์ของคุณ':'แชทโดยตรงได้'}</span></div>
      <div class="gallery-interests">${chips(c)}</div>${c.own?'':`<div class="gallery-actions">${primary(c,16)}${c.canRate?action('rate',h(c.id),c.star+'ให้คะแนน','',c.rateDisabled?'disabled':''):''}${action('block',h(c.id),'บล็อก','')}</div>`}</div></div>
      ${c.demo?'<p class="gallery-demo">รูปสมมติสำหรับทดลองหน้าจอ · บันทึกเฉพาะเบราว์เซอร์</p>':''}
      <div class="album-gallery-nav"><button data-profile-gallery>Gallery</button>${albumIconButton(c)}</div>
      ${c.own&&c.config.mediaUploadEnabled&&(!c.demo||c.id==='demo-me')?`<form id="route-gallery-upload" class="gallery-upload"><input type="hidden" name="kind" value="gallery"><label>เพิ่มรูป Gallery<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required></label><input name="caption" maxlength="300" aria-label="คำบรรยายรูป" placeholder="คำบรรยายรูป (ไม่บังคับ)"><button class="primary">${icon('upload',17)}${c.demo?'เพิ่มรูปตัวอย่าง':'เพิ่มรูป'}</button><small>เลือกรูปโปรไฟล์ได้ในหน้าจัดการรูป · JPG, PNG, WebP ไม่เกิน 8 MB</small><small data-route-gallery-quota></small></form>`:''}${privateAlbum(c)}${peopleActions(c)}
      ${c.galleryLoadError?'<p class="error" role="alert">โหลด Gallery ไม่สำเร็จ<button data-retry-gallery>ลองอีกครั้ง</button></p>':''}
      <div id="dialog-gallery">${!c.privateAlbumOpen?`<section aria-label="Gallery สาธารณะ"><h2 class="album-heading">Gallery</h2>${albumTiles(c,c.photos.filter(p=>p.visibility==='public'))}</section>`:''}
      ${c.privateAlbumOpen&&(c.own||c.album?.granted)?`<section aria-label="รูปอัลบั้มส่วนตัว">${albumTiles(c,c.photos.filter(p=>p.visibility!=='public'))}</section>`:''}</div>
      ${c.photos.length||c.galleryLoadError?'':`<div class="empty">${c.images}<h2>ยังไม่มีรูปใน Gallery</h2></div>`}</main>`;
  }
  function post(c) {
    const {photos,index,comments}=c.view,item=photos[index],h=c.html;
    if(!item) return `<main class="full-profile gallery-page"><p role="alert">ไม่พบรูปหรือคุณไม่มีสิทธิ์ดูรูปนี้</p><button data-profile-gallery>กลับไป Gallery</button></main>`;
    return `<main class="full-profile profile-route gallery-page"><article class="gallery-post-page"><header class="gallery-header"><button class="gallery-back" data-gallery-return="${h(c.id)}" aria-label="กลับไป Gallery">${icon('back',24)}</button>${brand('รูปภาพ')}<span></span></header>
      <div class="post-layout"><div class="post-owner"><div class="post-avatar">${c.portrait(c.person,false)}</div><strong>${h(c.person.name)}</strong>${c.demo?'<small class="fixture-label">ภาพสมมติ</small>':''}${c.own?'':`<button class="post-report" data-media-report="${h(item.id)}" aria-label="รายงานรูป">${icon('flag',17)}</button>`}</div>
      <div class="lightbox-image"><img src="${h(c.media(item.id))}" alt="${h(item.caption||'รูปใน Gallery')}"></div>
      <div class="post-social"><button class="post-like ${item.liked?'liked':''}" data-gallery-action="like" data-photo="${h(item.id)}" aria-pressed="${!!item.liked}">${icon('heart',22)}${Number(item.like_count||0)} Likes</button><p>${h(item.caption||'')}</p>
      <form id="gallery-comment" class="post-comment"><input type="hidden" name="photo" value="${h(item.id)}"><input type="hidden" name="owner" value="${h(c.id)}"><input name="comment" aria-label="คอมเมนต์" placeholder="เขียนถึงเจ้าของโปรไฟล์…" maxlength="500" required><button disabled>ส่ง</button></form>
      <small>ผู้ที่มีสิทธิ์ดูรูปนี้อ่านคอมเมนต์ได้</small><p data-post-feedback role="status" hidden></p>${true?`<div class="post-comments">${comments.slice().reverse().sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0)).map(comment=>`<div><strong>${h(comment.sender_name)}</strong><p>${h(comment.body)}</p></div>`).join('')||'<p>ยังไม่มีคอมเมนต์</p>'}</div>`:''}</div>
      <div class="lightbox-nav"><button data-gallery-action="previous" aria-label="รูปก่อนหน้า" ${index===0?'disabled':''}>${icon('previous',24)}</button><span>${index+1} / ${photos.length}</span><button data-gallery-action="next" aria-label="รูปถัดไป" ${index>=photos.length-1?'disabled':''}>${icon('next',24)}</button></div></div></article></main>`;
  }
  return {card, profile, gallery, post, icon, brand, privateAlbum};
})();
