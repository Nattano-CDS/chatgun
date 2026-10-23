import assert from 'node:assert/strict';
export function assertYouthFixtureScope(m){
 assert.equal(m?.syntheticOnly,true,'Not a synthetic manifest');
 assert.equal(m.database,'275d9820-6aec-494a-8bb5-b7ed9b8b74cc','Not isolated D1');
 assert.equal(m.origin,'https://issue13.chatgun-issue13-staging.pages.dev','Not isolated Preview');
 assert.match(m.run,/^youth-e2e-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u);
 assert.match(m.applicationSha,/^[a-f0-9]{40}$/u);
 assert.equal(m.actors?.length,10,'Incomplete synthetic scope');
 const expected=new Set(['under_13','13_17','18_19'].flatMap(band=>[390,768,1440].map(width=>band+'-'+width)).concat('control-390'));
 for(const a of m.actors){
  const key=a.band+'-'+a.width;assert.ok(expected.delete(key),'Unknown/duplicate synthetic actor');
  assert.ok(a.id===m.run+'-'+key,'Actor is outside this exact batch');
  for(const name of ['session','other',...(a.band==='control'?['stale','expired']:[])]){
   assert.ok(/^[A-Za-z0-9_-]{43}$/u.test(a[name]?.token||''),'Invalid synthetic session format');
   assert.ok(/^[A-Za-z0-9_-]{43}$/u.test(a[name]?.csrf||''),'Invalid synthetic CSRF format');
  }
 }
 assert.equal(expected.size,0);return m;
}
