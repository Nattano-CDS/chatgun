import test from 'node:test';import assert from 'node:assert/strict';
import {assertYouthFixtureScope} from '../scripts/lib/youth-fixture-scope.mjs';
function manifest(){const run='youth-e2e-00000000-0000-4000-8000-000000000001',session={token:'x'.repeat(43),csrf:'y'.repeat(43)};
 return{syntheticOnly:true,database:'275d9820-6aec-494a-8bb5-b7ed9b8b74cc',origin:'https://issue13.chatgun-issue13-staging.pages.dev',applicationSha:'a'.repeat(40),run,
 actors:['under_13','13_17','18_19','control'].flatMap(band=>(band==='control'?[390]:[390,768,1440]).map(width=>({band,width,id:run+'-'+band+'-'+width,session,other:session,...(band==='control'?{stale:session,expired:session}:{})}))) };}
test('exact ten-actor synthetic scope is accepted without real OAuth identities',()=>assert.doesNotThrow(()=>assertYouthFixtureScope(manifest())));
for(const [name,mutate]of [
 ['Production database',m=>{m.database='9738a051-d914-42d0-8e7b-8098ef2b959d';}],
 ['Production origin',m=>{m.origin='https://chatgun.social';}],
 ['unrelated account',m=>{m.actors[0].id='unrelated-user';}],
 ['duplicate actor',m=>{m.actors[1]=m.actors[0];}],
 ['credential header injection',m=>{m.actors[0].session={token:'invalid\r\nCookie: injected',csrf:'x'.repeat(43)};}],
 ['incomplete manifest',m=>{m.actors.pop();}],
])test('synthetic E2E rejects '+name,()=>{const m=manifest();mutate(m);assert.throws(()=>assertYouthFixtureScope(m));});
