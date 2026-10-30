import assert from 'node:assert/strict';
// Historical unbound checks stay fail-closed unless the caller explicitly checks
// the owner-authorized private Production binding. Never accept arbitrary R2.
export function assertProductionMediaBinding(bindings,mode=process.env.CHATGUN_EXPECT_PRODUCTION_MEDIA||'unbound'){
  assert.ok(['unbound','private-bound'].includes(mode),'Unknown Production media expectation');
  if(mode==='unbound')assert.deepEqual(bindings||{},{});
  else assert.deepEqual(bindings,{MEDIA:{name:'chatgun-media-production'}});
}
