// Retry only an identical pending operation. No background sends or local PII storage.
export function createMessageDelivery(request,uuid=()=>crypto.randomUUID()) {
  const pending=new Map();
  return async function send(payload){
    const fingerprint=JSON.stringify([payload.target,payload.body||'',payload.mediaId||null]);
    if(!pending.has(fingerprint)){
      if(pending.size>=20)throw new Error('มีข้อความที่ส่งไม่สำเร็จหลายรายการ กรุณาลองส่งข้อความเดิมก่อน');
      pending.set(fingerprint,uuid());
    }
    const result=await request('/api/social/messages',{method:'POST',body:{...payload,action:'send',clientRequestId:pending.get(fingerprint)}});
    pending.delete(fingerprint);
    return result;
  };
}
