/* Isolated public fiction. No OAuth identities, sessions, locations or member API reads. */
window.chatgunDemoNetwork = async function () {
  const response = await fetch("/assets/demo/network.json", { credentials: "omit" });
  if (!response.ok) throw new Error("โหลดข้อมูลตัวอย่างไม่สำเร็จ กรุณาลองใหม่");
  const fixture = await response.json();
  if (fixture.batchId !== "chatgun-browser-demo-v1" || fixture.fictional !== true || fixture.profiles.length !== 20) throw new Error("ข้อมูลตัวอย่างไม่พร้อม");
  const now = Math.floor(Date.now() / 1000);
  const people = fixture.profiles.map((p,i) => ({ ...p, user_id: `demo-${p.slug}`, selected_photo_id: `demo-portrait-${p.slug}`, distance: 250*(i+1), distance_label: "ระยะสมมติ", rating: 4+(i%10)/10, rating_count: i+2 }));
  const conversations = fixture.conversations.map(c => ({ ...c, person: people.find(p => p.slug === c.with) }));
  const relationships = conversations.map((c,i) => ({ ...c.person, other_user_id: c.person.user_id, requested_by: c.person.user_id, status: "accepted", updated_at: now-i*60, last_message_at: now-i*60, last_message_body: c.messages.at(-1), last_message_sender_id: c.person.user_id, unread_count: i<3?i+1:0 }));
  relationships.push(...people.slice(11,16).map(p => ({ ...p, other_user_id:p.user_id, requested_by:p.user_id,status:"pending",updated_at:now })));
  const messages = Object.fromEntries(conversations.map(c => [c.person.user_id,c.messages.map((body,i) => ({ id:`demo-message-${c.with}-${i}`,sender_user_id:i%2?"demo-me":c.person.user_id,receiver_user_id:i%2?c.person.user_id:"demo-me",body,created_at:now-(12-i)*120 }))]));
  const gallery = people.map(p => ({ id:p.selected_photo_id,owner:p.user_id,caption:`ภาพตัวละครสมมติ ${p.name}`,url:`/assets/demo/${p.slug}.png`,like_count:3,liked:false,comments:[{id:`demo-comment-${p.slug}`,sender_name:"เพื่อนตัวอย่าง",body:"รูปนี้ดูสดใสดีมาก",created_at:now}] }));
  gallery.push(...people.slice(0,2).map(p => ({id:`demo-own-${p.slug}`,owner:"demo-me",caption:"แกลเลอรีตัวอย่าง — ตัวละครสมมติ",url:`/assets/demo/${p.slug}.png`,like_count:4,liked:false,comments:[]})));
  return { people,relationships,messages,gallery,ratings:people.slice(0,15).map((p,i)=>({id:`demo-rating-${i}`,sender_name:p.name,score:4+i%2,comment:["คุยเป็นกันเองและสุภาพ","ชอบแลกเปลี่ยนเรื่องคาเฟ่กับหนังสือ","เป็นเพื่อนที่รับฟังและให้เกียรติกัน"][i%3],created_at:now-i*3600})),notifications:[{id:"demo-notice-1",message:"ตัวอย่าง: รูปภาพของคุณผ่านการตรวจแล้ว",created_at:now}] };
};
