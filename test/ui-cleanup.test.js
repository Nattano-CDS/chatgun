import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const window={};for(const file of ['app/near-icons.js','app/near-components.js'])vm.runInNewContext(readFileSync(file,'utf8'),{window});
const c={person:{name:'สมมติ',identity_verified:1},id:'sample',html:String,portrait:()=>'',photos:[],config:{messagingEnabled:true},album:{granted:false},media:()=>'',images:'',grid:'',star:'<svg></svg>'};
test('every member and own card has one semantic profile link and no action buttons',()=>{
  for(const own of [false,true]){
    const out=window.ChatgunNearComponents.card({...c,own,canRate:true,messagingEnabled:true});
    assert.equal((out.match(/<a /g)||[]).length,1);assert.match(out,/href="\/app\/people\/sample"/);
    assert.doesNotMatch(out,/<button|data-action=|self-profile-open|card-actions/);
    assert.match(out,/class="person-name"/);if(!own)assert.match(out,/class="verify-badge" role="img"/);
  }
});
test('all profile consent states have exactly one Gallery and no verbose album controls',()=>{
  for(const status of ['pending','approved','rejected','revoked','cancelled'])for(const own of [false,true]){
    const out=window.ChatgunNearComponents.profile({...c,own,privateAlbumOpen:true,album:{granted:status==='approved',request:{status,id:'r',revision:1}}});
    assert.equal((out.match(/data-profile-gallery/g)||[]).length,1);
    assert.match(out,/data-profile-gallery>.*?<\/button><button type="button" class="private-album-icon"/);
    assert.doesNotMatch(out,/profile-gallery-top|album-feedback|album-management|data-demo-owner|data-album-action|ส่งคำขอแล้ว · รออนุมัติในแชท|ยกเลิกคำขอ<\/button>/);
  }
});
test('final approved image and padlock SVG composition is source-exact and demo switching is removed',()=>{
  const before=execFileSync('git',['show','b6ba87434a82e655bff0cea39ce637fca5488b4a:app/near-components.js'],{encoding:'utf8'});
  const now=readFileSync('app/near-components.js','utf8');
  const extract=s=>s.match(/  function albumIconButton\(c\)\{[\s\S]*?\n  \}/)[0];assert.equal(extract(now),extract(before));
  const css=readFileSync('app/near-components.css','utf8'),oldCss=execFileSync('git',['show','b6ba87434a82e655bff0cea39ce637fca5488b4a:app/near-components.css'],{encoding:'utf8'});
  const rules=s=>s.split('\n').filter(l=>/private-album-icon|album-icon-art|album-lock-badge/.test(l)).join('\n');assert.equal(rules(css),rules(oldCss));
  const script=readFileSync('app/social.js','utf8');assert.doesNotMatch(script,/data-demo-owner/);
});
