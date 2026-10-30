/* Original, code-drawn fictional artwork. No real photographs or locations.
 * Additive browser-only dataset: once marked, deleted content stays deleted. */
export const galleryBatch='chatgun-gallery-approved-v1';
export function scene(index){
  const colors=[['#e9d8b7','#b6a0ad','#51486d'],['#b8dbd2','#9ebcb8','#405866'],['#f6c6b5','#d89a9b','#785981'],['#d6bad8','#ab9ac0','#5b6a96'],['#e4d3a3','#b1b58f','#476760'],['#adcfdc','#94b9ca','#5e648d']][index%6];
  const subjects=[
    '<path d="M0 0h100v80q0 50-50 50T0 80z"/><path d="M100 15q85-5 20 65M20-25q-25-25 0-50m40 50q-25-25 0-50" fill="none" stroke="#fff1ce" stroke-width="12"/>',
    '<path d="M0 10-10-45 40-15 80-45 90 10Q130 100 45 120-40 100 0 10Z"/><path d="m18 40 7 4m35-4 7 4m-30 20 8 7 8-7" fill="none" stroke="#51486d" stroke-width="6"/><path d="M30 115v55h85q45-5 30-50" fill="none" stroke="#fff1ce" stroke-width="18"/>',
    '<path d="M-20 60h160q-5 80-80 80T-20 60Z"/><circle cx="15" cy="30" r="30"/><circle cx="65" cy="15" r="32"/><circle cx="115" cy="35" r="27"/><path d="m60-18 15-25" fill="none" stroke="#476760" stroke-width="10"/>',
    '<rect x="-25" y="-45" width="160" height="165" rx="5"/><path d="m0 65 35-50 35 30 35-55" fill="none" stroke="#785981" stroke-width="12"/><path d="M0 155h110m-75-35-15 50m65-50 15 50" fill="none" stroke="#fff1ce" stroke-width="10"/>',
    '<path d="m-20 0 35-35h70l25 35h35v110H-30V0Z"/><circle cx="55" cy="53" r="37" fill="#51486d"/><circle cx="55" cy="53" r="22" fill="#adcfdc"/><rect x="105" y="15" width="20" height="13" fill="#51486d"/>',
    '<path d="M15 70h100l-15 100H30Z"/><path d="M65 70V-30M60 20Q0-25 5 30q10 25 55 20M70 40q70-70 65-10-5 35-65 35" fill="none" stroke="#476760" stroke-width="9"/><circle cx="65" cy="-40" r="35"/><circle cx="65" cy="-40" r="12" fill="#d89a9b"/>',
    '',
  ];
  const [a,b,c]=colors;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path fill="url(#g)" d="M0 0h600v600H0z"/><circle cx="145" cy="140" r="82" fill="#fff1ce" opacity=".7"/><path d="M0 365Q110 270 270 345T600 330V600H0" fill="${c}" opacity=".28"/><path d="M0 480Q130 310 290 420T600 400V600H0" fill="${c}" opacity=".65"/><path d="M0 550Q150 460 300 530T600 500V600H0" fill="${c}"/><g transform="translate(345 225)" fill="#fff1ce">${subjects[index%7]}</g></svg>`);
}
export function initializeGallery(state,saved){
  if(saved?.galleryBatch===galleryBatch)return galleryBatch;
  const captions=['กาแฟยามเช้า','ทริปในจินตนาการ','มื้อโปรดในวันหยุด','แมวน้อยในจินตนาการ','สมุดวาดรูปกับเวลาว่าง','ดอกไม้บนโต๊ะทำงาน','กล้องคู่ใจในทริปสมมติ','สีสันที่ชอบ','หนังสือในวันสบาย ๆ','ผลไม้และมื้อเช้า','งานศิลปะชิ้นโปรด','แสงเย็นในโลกสมมติ'].map(s=>s+' · ภาพวาดสมมติ');
  for(const [n,owner] of ['demo-me',...state.people.map(p=>p.user_id)].entries()){
    const existingPrivate=state.demoGallery.filter(p=>p.owner===owner&&p.visibility==='private').length;
    for(const visibility of ['public','private'])for(let i=0;i<(owner==='demo-me'&&visibility==='private'?Math.max(0,4-existingPrivate):4);i++){
      if(state.demoGallery.filter(p=>p.owner===owner).length>=12)break;
      const id=`${galleryBatch}-${owner}-${visibility}-${i}`;
      if(!state.demoGallery.some(p=>p.id===id))state.demoGallery.push({id,seed_batch:galleryBatch,owner,visibility,caption:captions[(n*4+i)%captions.length],url:scene(n+i+(visibility==='private'?3:0)),review_status:'released',like_count:3+(n+i)%18,comments:[{id:id+'-c',sender_name:'เพื่อนสมมติ',body:['สีสวยมากเลย ดูแล้วสบายใจ','ชอบบรรยากาศแบบนี้เหมือนกัน','ไอเดียน่ารักดี ขอบคุณที่แบ่งปัน'][i%3],created_at:1}]});
    }
  }
  for(const [i,review_status] of ['pending','rejected'].entries()){
    if(state.demoGallery.filter(p=>p.owner==='demo-me').length>=12)break;
    state.demoGallery.push({id:galleryBatch+'-review-'+i,seed_batch:galleryBatch,owner:'demo-me',visibility:'public',caption:'ตัวอย่างสถานะตรวจรูป · สมมติ',url:scene(i+2),review_status,like_count:0,comments:[]});
  }
  for(const [i,status] of ['approved','pending','revoked','rejected'].entries()){
    const owner=['demo-08','demo-09','demo-10','demo-07'][i];
    if(state.demoAlbumRequests.some(r=>r.album_owner_id===owner&&r.requester_id==='demo-me'))continue;
    const id=galleryBatch+'-access-'+i,revision=status==='pending'?1:2;
    state.demoAlbumRequests.push({id,seed_batch:galleryBatch,album_owner_id:owner,requester_id:'demo-me',status,revision,created_at:1,updated_at:1});
    state.demoSystemEvents.push({id:id+'-event',request_id:id,album_owner_id:owner,requester_id:'demo-me',event_type:status,revision,created_at:1,system:true,readBy:[owner,'demo-me'],seed_batch:galleryBatch});
  }
  return galleryBatch;
}
export function resetGalleryBatch(state,{confirmed=false}={}){
  const ids=new Set(state.demoGallery.filter(p=>p.seed_batch===galleryBatch).map(p=>p.id));
  const requests=new Set(state.demoAlbumRequests.filter(r=>r.seed_batch===galleryBatch||r.id.startsWith(galleryBatch+'-access-')).map(r=>r.id));
  const summary={batch:galleryBatch,photos:ids.size,requests:requests.size,dryRun:!confirmed};
  if(!confirmed)return summary;
  state.demoGallery=state.demoGallery.filter(p=>!ids.has(p.id));
  state.demoAlbumRequests=state.demoAlbumRequests.filter(r=>!requests.has(r.id));
  state.demoSystemEvents=state.demoSystemEvents.filter(e=>!requests.has(e.request_id));
  state.galleryBatch=initializeGallery(state,null);
  return summary;
}
