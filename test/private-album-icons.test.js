import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};
vm.runInNewContext(readFileSync('app/near-icons.js','utf8'),{window});
vm.runInNewContext(readFileSync('app/near-components.js','utf8'),{window});
const c={person:{name:'สมมติ'},id:'fixture',html:String,portrait:()=>'',photos:[],config:{},album:{granted:false},media:()=>'',images:'',grid:'',star:''};
const profile=overrides=>window.ChatgunNearComponents.profile({...c,...overrides});
test('approved locked and unlocked composition uses identical Lucide image with distinct standard locks',()=>{
  const locked=profile({}),unlocked=profile({album:{granted:true}});
  for(const out of [locked,unlocked]){
    assert.equal((out.match(/data-private-album /g)||[]).length,1);
    assert.match(out,/Gallery <span>0<\/span><\/button><button type="button" class="private-album-icon"/);
    assert.match(out,/<rect width="18" height="18" x="3" y="3"/);
    assert.match(out,/class="album-lock-badge"/);
    assert.doesNotMatch(out,/class="private-album"|ล็อก ·|เจ้าของต้องอนุมัติ|ขอดูอัลบั้มส่วนตัว<\/button>/);
    assert.match(out,/aria-label="[^"]+" title=/);
  }
  assert.match(locked,/data-album-state="locked"/);assert.match(locked,/M7 11V7a5 5 0 0 1 10 0v4/);
  assert.match(unlocked,/data-album-state="unlocked"/);assert.match(unlocked,/M7 11V7a5 5 0 0 1 9.9-1/);
});
test('pending duplicate prevention, loading fail-closed and own-profile management remain explicit',()=>{
  const pending=profile({album:{granted:false,request:{status:'pending',id:'r',revision:1}}});
  assert.match(pending,/data-album-state="locked"[^>]+disabled/);assert.match(pending,/aria-label="ส่งคำขอแล้ว รออนุมัติอัลบั้มส่วนตัว"/);assert.doesNotMatch(pending,/album-feedback|data-album-action="cancel"|data-demo-owner/);
  assert.match(profile({albumLoading:true}),/data-album-state="locked"[^>]+disabled/);
  assert.match(profile({galleryLoadError:true}),/data-album-state="locked"[^>]+disabled/);
  assert.match(profile({own:true}),/data-album-state="unlocked"/);
  assert.doesNotMatch(profile({own:true}),/album-management/);
  assert.match(window.ChatgunNearComponents.gallery({...c,own:true,privateAlbumOpen:true,albumRequests:[{requester_name:'สมมติ',status:'approved',id:'r',revision:2}]}),/data-album-action="revoke"/);
});
test('public and private album rendering are separate, never inferred from an unlocked client flag',()=>{
  const photos=[{id:'public',visibility:'public'},{id:'private',visibility:'private'}];
  const render=overrides=>window.ChatgunNearComponents.gallery({...c,photos,...overrides});
  assert.doesNotMatch(render({album:{granted:true}}),/data-photo="private"/);
  assert.doesNotMatch(render({privateAlbumOpen:true,album:{granted:false}}),/data-photo="private"/);
  assert.match(render({privateAlbumOpen:true,album:{granted:true}}),/data-photo="private"/);
  assert.doesNotMatch(render({privateAlbumOpen:true,album:{granted:true}}),/data-photo="public"/);
});
