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
  function card({person:p,id,relation,incoming,context,html:h,portrait,distance,star,userPlus,canRate,rateDisabled,own=false,demo=false}) {
    const request = context === 'request' || context === 'sent';
    const body = `<article class="person photo-card person-card" data-person="${h(id)}">
      <button class="card-open" data-person-open="${h(id)}" aria-label="เปิดโปรไฟล์ ${h(p.name)}"></button>
      <div class="card-photo">${portrait(p,false)}</div><div class="photo-shade"></div>
      ${own ? '<span class="self-card-badge">คุณ</span>' : `<span class="card-distance">${icon('pin',14)}${h(distance)}</span>`}
      ${!own && incoming ? `<button class="incoming-bell" data-show-requests aria-label="${h(p.name)} ส่งคำขอเป็นเพื่อน">${userPlus}<span class="request-dot"></span></button>` : ''}
      <div class="person-details"><div class="person-top"></div>
        <div class="card-name-row"><button class="person-name" data-person-open="${h(id)}">${h(p.name)}</button>${own?'':badge(p)}</div>
        <p class="person-bio">${h(p.bio || 'ยินดีที่ได้รู้จัก')}</p>
        <div class="rating-line">${own ? (demo?'โปรไฟล์ของคุณ · ตัวอย่าง':'โปรไฟล์ของคุณ') : p.rating_count ? Number(p.rating).toFixed(1) : 'ยังไม่มีคะแนน'}</div>
        <div class="card-actions">${own?`<button class="icon-button self-profile-open" data-person-open="${h(id)}" aria-label="ดูโปรไฟล์ของคุณ" title="ดูโปรไฟล์">${icon('next',22)}</button>`:canRate ? action('rate',h(id),star,'icon-button rate-button',`aria-label="ให้คะแนน" ${rateDisabled ? 'disabled' : ''}`) : ''}</div>
      </div></article>`;
    return request ? `<div class="request-card">${body}<div class="request-decisions">${context==='request' ? action('accept',h(id),'ยอมรับ','primary')+action('reject',h(id),'ปฏิเสธ','secondary') : action('cancel',h(id),'ยกเลิกคำขอ','secondary')}</div></div>` : body;
  }
  function peopleActions(c, block = false) {
    if(c.own) return '';
    const id=c.html(c.id), r=c.relation;
    return `<div class="people-management">${r?.status==='pending'&& !c.incoming ? action('cancel',id,'ยกเลิกคำขอ','') : ''}${r?.status==='accepted' ? action('unfriend',id,'เลิกเป็นเพื่อน','') : ''}<span class="safety-actions">${action('report',id,icon('flag',15)+'รายงานผู้ใช้','')}${block ? action('block',id,'บล็อกผู้ใช้','') : ''}</span></div>`;
  }
  function primary(c, size=19) {
    if(c.own) return '';
    const id=c.html(c.id);
    if(c.relation?.status==='accepted') return c.config.messagingEnabled ? action('chat',id,icon('chat',size)+'แชท','primary') : '';
    if(!c.config.friendRequestsEnabled) return '';
    return action(c.incoming?'accept':'request',id,c.userPlus+(c.incoming?'ยอมรับคำขอ':c.relation?.status==='pending'?'ส่งคำขอแล้ว':'เพิ่มเพื่อน'),'primary',c.relation?.status==='pending'&&!c.incoming?'disabled':'');
  }
  const chips = c => String(c.person.interests||'').split(',').map(i=>i.trim()).filter(Boolean).map(i=>`<span>${c.html(i)}</span>`).join('');
  const score = c => c.person.rating_count ? `${Number(c.person.rating).toFixed(1)} · ${Number(c.person.rating_count)} คะแนน` : 'ยังไม่มีคะแนน';
  function profile(c) {
    const p=c.person,h=c.html;
    return `<main class="full-profile profile-route" aria-label="โปรไฟล์ ${h(p.name)}"><h1 class="sr-only">โปรไฟล์ ${h(p.name)}</h1>
      <div class="full-profile-image">${c.portrait(p,false)}</div><div class="full-profile-shade"></div>
      <button class="profile-back" data-close-profile aria-label="กลับ">${icon('back',24)}</button>
      ${brand('โปรไฟล์','profile-page-brand')}
      <button class="profile-gallery-top" data-profile-gallery>${c.images}Gallery</button>
      <div class="full-profile-info"><div class="full-name-row"><h1>${h(p.name)}</h1>${badge(p,25)}</div>
        <p class="full-bio">${h(p.bio||'ยังไม่ได้เขียน Bio')}</p>
        <div class="profile-facts"><span>${h(p.gender||'ไม่ระบุเพศ')}</span>${p.distance!=null?`<span>${icon('pin',15)}${h(c.distance)}</span>`:''}<span>${c.star}${score(c)}</span></div>
        <div class="profile-interests">${chips(c)}</div>
        <div class="full-profile-actions">${primary(c)}<button class="profile-gallery-button" data-profile-gallery>${c.grid}Gallery <span>${c.photos.length}</span></button>${c.canRate ? action('rate',h(c.id),c.star,'profile-rate',`aria-label="ให้คะแนน" ${c.rateDisabled?'disabled':''}`):''}</div>
        ${peopleActions(c,true)}${c.demo?'<span class="fixture-label">บุคคลสมมติ · เฉพาะเบราว์เซอร์</span>':''}
      </div></main>`;
  }
  function gallery(c) {
    const p=c.person,h=c.html;
    return `<main class="full-profile profile-route gallery-page" aria-label="Gallery ${h(p.name)}">
      <header class="gallery-header"><button class="gallery-back" data-profile-return aria-label="กลับไปโปรไฟล์">${icon('back',23)}</button>${brand('Gallery')}<button class="gallery-back" data-close-profile aria-label="ปิด Gallery">${icon('close',22)}</button></header>
      <div class="gallery-summary"><div class="gallery-avatar">${c.portrait(p,false)}</div><div><h2>${h(p.name)}${badge(p)}</h2><span>${c.photos.length} รูป · ${score(c)}</span><p>${h(p.bio||'ยังไม่ได้เขียน Bio')}</p>
      <div class="gallery-facts"><span>${h(p.gender||'ไม่ระบุเพศ')}</span>${p.distance!=null?`<span>${icon('pin',14)}${h(c.distance)}</span>`:''}<span>${c.own?'โปรไฟล์ของคุณ':c.relation?.status==='accepted'?'เป็นเพื่อนกันแล้ว':c.incoming?'ส่งคำขอเป็นเพื่อนถึงคุณ':c.relation?.status==='pending'?'ส่งคำขอแล้ว':'ยังไม่ได้เป็นเพื่อน'}</span></div>
      <div class="gallery-interests">${chips(c)}</div>${c.own?'':`<div class="gallery-actions">${primary(c,16)}${c.canRate?action('rate',h(c.id),c.star+'ให้คะแนน','',c.rateDisabled?'disabled':''):''}${action('block',h(c.id),'บล็อก','')}</div>`}</div></div>
      ${c.demo?'<p class="gallery-demo">รูปสมมติสำหรับทดลองหน้าจอ · บันทึกเฉพาะเบราว์เซอร์</p>':''}
      ${c.own&&c.config.mediaUploadEnabled?`<form id="route-gallery-upload" class="gallery-upload"><input type="hidden" name="kind" value="gallery"><label>เพิ่มรูป Gallery<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required></label><input name="caption" maxlength="300" aria-label="คำบรรยายรูป" placeholder="คำบรรยายรูป (ไม่บังคับ)"><button class="primary">${icon('upload',17)}${c.demo?'เพิ่มรูปตัวอย่าง':'เพิ่มรูป'}</button><small>เลือกรูปโปรไฟล์ได้ในหน้าจัดการรูป · JPG, PNG, WebP ไม่เกิน 8 MB</small><small data-route-gallery-quota></small></form>`:''}${peopleActions(c)}
      ${c.galleryLoadError?'<p class="error" role="alert">โหลด Gallery ไม่สำเร็จ<button data-retry-gallery>ลองอีกครั้ง</button></p>':''}
      <div id="dialog-gallery" class="ig-grid">${c.photos.map((photo,i)=>`<div class="ig-tile"><button data-gallery-action="view" data-user="${h(c.id)}" data-photo="${h(photo.id)}" aria-label="ดูรูป ${h(photo.caption||i+1)}"><img src="${h(c.media(photo.id))}" alt="${h(photo.caption||'รูป Gallery')}" loading="lazy"><span class="tile-likes">${icon('heart',12)}${Number(photo.like_count||0)}</span></button>${c.own?`<button class="delete-photo" data-gallery-action="delete" data-photo="${h(photo.id)}" aria-label="ลบรูป">${icon('trash',15)}</button>`:''}</div>`).join('')}</div>
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
      <small>เจ้าของโปรไฟล์และเพื่อนอ่านคอมเมนต์ได้</small>${c.own||c.relation?.status==='accepted'?`<div class="post-comments">${comments.map(comment=>`<div><strong>${h(comment.sender_name)}</strong><p>${h(comment.body)}</p></div>`).join('')||'<p>ยังไม่มีคอมเมนต์</p>'}</div>`:''}</div>
      <div class="lightbox-nav"><button data-gallery-action="previous" aria-label="รูปก่อนหน้า" ${index===0?'disabled':''}>${icon('previous',24)}</button><span>${index+1} / ${photos.length}</span><button data-gallery-action="next" aria-label="รูปถัดไป" ${index>=photos.length-1?'disabled':''}>${icon('next',24)}</button></div></div></article></main>`;
  }
  return {card, profile, gallery, post, icon, brand};
})();
