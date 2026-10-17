// No location, login-history, or client-invented status. Server booleans only.
export function createOnlinePresence({request,targets,apply,preference=()=>{},doc=document,now=Date.now,every=setInterval,cancel=clearInterval}) {
  const tabId=crypto.randomUUID().replaceAll('-','');
  let enabled=false,stopped=false,busy=false,queued=false,lastActivity=now(),lastBeat=-Infinity,generation=0,timer;
  const clear=()=>apply(Object.fromEntries(targets().map(id=>[id,false])));
  const offline=()=>{lastBeat=-Infinity;clear();return request('/api/social/online',{method:'POST',keepalive:true,body:{action:'offline',tabId}}).catch(()=>{});};
  const tick=async()=>{
    if(stopped)return;
    if(busy){queued=true;return;}
    if(doc.visibilityState!=='visible'){clear();return;}
    busy=true;
    const revision=generation;
    try {
      if(enabled&&now()-lastActivity<110000){if(now()-lastBeat>=30000){await request('/api/social/online',{method:'POST',body:{action:'heartbeat',foreground:true,tabId}});lastBeat=now();}}
      else if(enabled)await offline();
      const ids=[...new Set(targets())].slice(0,50);
      const result=await request('/api/social/online?users='+encodeURIComponent(ids.join(',')));
      if(stopped||generation!==revision)return;
      enabled=result.showOnline===true;preference(enabled);
      apply(Object.fromEntries(ids.map(id=>[id,result.statuses?.[id]===true])));
    } catch(error){clear();if(error.status===401||error.status===403)stop();}
    finally{busy=false;if(queued&&!stopped){queued=false;queueMicrotask(()=>void tick());}}
  };
  const active=()=>{lastActivity=now();};
  const visibility=()=>{if(doc.visibilityState!=='visible')void offline();else{active();void tick();}};
  const stop=()=>{stopped=true;cancel(timer);clear();for(const event of ['pointerdown','keydown','scroll','touchstart'])doc.removeEventListener(event,active);doc.removeEventListener('visibilitychange',visibility);};
  return {
    async start(){for(const event of ['pointerdown','keydown','scroll','touchstart'])doc.addEventListener(event,active,{passive:true});doc.addEventListener('visibilitychange',visibility);await tick();if(enabled)await tick();if(!stopped)timer=every(()=>void tick(),45000);},
    async setVisible(value){generation++;await request('/api/social/online',{method:'POST',body:{action:'preference',enabled:value}});enabled=value;preference(value);lastBeat=-Infinity;if(!value)clear();active();await tick();},
    refresh:tick,stop,
  };
}
