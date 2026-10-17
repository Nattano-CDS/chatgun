import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync('app/demo-network.js','utf8'),{window});
const upgrade=window.chatgunUpgradeDemoReads;
function thread(){return {other:[1,2,3].map(n=>({id:'m'+n,sender_user_id:'other',receiver_user_id:'demo-me',body:'body'+n,created_at:n}))};}
test('legacy read conversations remain read without replacing message history',()=>{
  const messages=thread(),ids=messages.other.map(m=>m.id),bodies=messages.other.map(m=>m.body);
  upgrade(messages,[{other_user_id:'other',unread_count:0}],false,100);
  assert.deepEqual(messages.other.map(m=>m.read_at),[100,100,100]);assert.deepEqual(messages.other.map(m=>m.id),ids);assert.deepEqual(messages.other.map(m=>m.body),bodies);
});
test('legacy unread count maps to newest incoming messages and preserves explicit reads',()=>{
  const messages=thread();messages.other[0].read_at=42;
  upgrade(messages,[{other_user_id:'other',unread_count:1}],false,100);
  assert.deepEqual(messages.other.map(m=>m.read_at),[42,100,null]);
});
test('current consent-model snapshots are never reinterpreted using obsolete friendship counters',()=>{
  const messages=thread(),before=JSON.stringify(messages);upgrade(messages,[{other_user_id:'other',unread_count:0}],true,100);assert.equal(JSON.stringify(messages),before);
});
