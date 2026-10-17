/* Original, code-drawn fictional artwork. No real photographs or locations.
 * Additive browser-only dataset: once marked, deleted content stays deleted. */
export const galleryBatch='chatgun-gallery-approved-v1';
export function scene(index){
  const colors=[['#e9d8b7','#b6a0ad','#51486d'],['#b8dbd2','#9ebcb8','#405866'],['#f6c6b5','#d89a9b','#785981'],['#d6bad8','#ab9ac0','#5b6a96'],['#e4d3a3','#b1b58f','#476760'],['#adcfdc','#94b9ca','#5e648d']][index%6];
  const [a,b,c]=colors;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path fill="url(#g)" d="M0 0h600v600H0z"/><circle cx="145" cy="140" r="82" fill="#fff1ce" opacity=".7"/><path d="M0 365Q110 270 270 345T600 330V600H0" fill="${c}" opacity=".28"/><path d="M0 480Q130 310 290 420T600 400V600H0" fill="${c}" opacity=".65"/><path d="M0 550Q150 460 300 530T600 500V600H0" fill="${c}"/>${index%4===0?'<g transform="translate(345 225)" fill="#fff1ce"><path d="M0 0h100v80q0 50-50 50T0 80z"/><path d="M100 15q85-5 20 65" fill="none" stroke="#fff1ce" stroke-width="18"/><path d="M20-25q-25-25 0-50m40 50q-25-25 0-50" fill="none" stroke="#fff1ce" stroke-width="7"/></g>':''}</svg>`);
}
export function initializeGallery(state,saved){
  if(saved?.galleryBatch===galleryBatch)return galleryBatch;
  const captions=['กาแฟยามเช้า · ภาพวาดสมมติ','ทริปในจินตนาการ · ภาพวาดสมมติ','แสงเย็นกับวันสบาย ๆ · ภาพวาดสมมติ','สีสันที่ชอบ · ภาพวาดสมมติ'];
  for(const [n,owner] of ['demo-me',...state.people.map(p=>p.user_id)].entries()){
    const existingPrivate=state.demoGallery.filter(p=>p.owner===owner&&p.visibility==='private').length;
    for(const visibility of ['public','private'])for(let i=0;i<(owner==='demo-me'&&visibility==='private'?Math.max(0,4-existingPrivate):4);i++){
      if(state.demoGallery.filter(p=>p.owner===owner).length>=12)break;
      const id=`${galleryBatch}-${owner}-${visibility}-${i}`;
      if(!state.demoGallery.some(p=>p.id===id))state.demoGallery.push({id,seed_batch:galleryBatch,owner,visibility,caption:captions[i],url:scene(n+i+(visibility==='private'?3:0)),review_status:'released',like_count:3+(n+i)%18,comments:[{id:id+'-c',sender_name:'เพื่อนสมมติ',body:'สีสวยมากเลย ดูแล้วสบายใจ',created_at:1}]});
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
    state.demoAlbumRequests.push({id,album_owner_id:owner,requester_id:'demo-me',status,revision,created_at:1,updated_at:1});
    state.demoSystemEvents.push({id:id+'-event',request_id:id,album_owner_id:owner,requester_id:'demo-me',event_type:status,revision,created_at:1,system:true,readBy:[owner,'demo-me'],seed_batch:galleryBatch});
  }
  return galleryBatch;
}
