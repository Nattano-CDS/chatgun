const DB='chatgun-demo',STORE='state',KEY='chatgun-browser-demo-v1';
// Only the exact legacy fictional key is removable. No cookie/localStorage reset.
export async function openRetiredDemo(indexed=indexedDB) {
  const known=await indexed.databases();
  if(!known.some(database=>database.name===DB))return null;
  const db=await new Promise((resolve,reject)=>{const r=indexed.open(DB);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(!db.objectStoreNames.contains(STORE)){db.close();return null;}
  const read=()=>new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const snapshot=await read();
  if(!snapshot){db.close();return null;}
  return {snapshot,close:()=>db.close(),async remove(){
    // Abort if another tab edited the key after the recovery/export notice opened.
    const expected=JSON.stringify(snapshot);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),get=store.get(KEY);
      get.onsuccess=()=>{if(JSON.stringify(get.result)!==expected){tx.abort();return;}store.delete(KEY);};
      tx.oncomplete=resolve;tx.onabort=()=>reject(Error('ข้อมูลตัวอย่างเปลี่ยนแปลงในอีกแท็บ กรุณาโหลดหน้านี้ใหม่ก่อนลบ'));tx.onerror=()=>reject(tx.error);
    });db.close();
  }};
}

export async function offerDemoRetirement(host) {
  try {
    const retired=await openRetiredDemo();if(!retired)return;
    host.hidden=false;
    host.innerHTML='<h2>เลิกใช้ข้อมูลตัวอย่างแล้ว</h2><p>รูปและแชทที่แก้ไขในโหมดตัวอย่างเก็บอยู่เฉพาะในเบราว์เซอร์นี้ ไม่ใช่บัญชีสมาชิก คุณสามารถดาวน์โหลดสำเนาก่อนลบได้ การลบนี้ไม่ลบบัญชี เซสชัน หรือข้อมูลเว็บไซต์อื่น</p><button type="button" data-export-retired>ดาวน์โหลดสำเนาข้อมูลตัวอย่าง</button><button type="button" data-remove-retired>ลบเฉพาะข้อมูลตัวอย่าง</button><p role="status" data-retired-status></p>';
    host.querySelector('[data-export-retired]').onclick=()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(retired.snapshot,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='chatgun-retired-demo-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      host.querySelector('[data-retired-status]').textContent='เก็บไฟล์สำเนาไว้ในที่ปลอดภัยก่อนลบ ข้อมูลนี้ไม่ถูกส่งขึ้นเซิร์ฟเวอร์';
    };
    host.querySelector('[data-remove-retired]').onclick=async()=>{try{await retired.remove();host.innerHTML='<p role="status">ลบเฉพาะข้อมูลตัวอย่างแล้ว บัญชีและเซสชันของคุณไม่ได้ถูกลบ</p>';}catch(error){host.querySelector('[data-retired-status]').textContent=error.message;}};
    addEventListener('pagehide',retired.close,{once:true});
  } catch {host.hidden=false;host.textContent='ไม่สามารถเปิดข้อมูลตัวอย่างที่เก็บในเบราว์เซอร์ได้ ข้อมูลยังไม่ถูกลบ กรุณาลองใหม่ในเบราว์เซอร์เดิม';}
}
