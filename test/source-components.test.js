import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};vm.runInNewContext(readFileSync('app/near-icons.js','utf8'),{window});
vm.runInNewContext(readFileSync('app/near-components.js','utf8'),{window});
const ui=window.ChatgunNearComponents;
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const person={name:'x" onerror="alert(1)',bio:'<script>bad</script>',gender:'ไม่ระบุ',interests:'กาแฟ,<img>',rating:4,rating_count:2};
const context={person,id:'fixture',html,portrait:()=>'<img class="profile-photo" alt="fiction">',media:()=>'/assets/demo/01.png',distance:'ระยะสมมติ',photos:[{id:'photo',caption:'สมมติ',like_count:0}],config:{friendRequestsEnabled:true,messagingEnabled:true},star:'<svg></svg>',images:'<svg></svg>',grid:'<svg></svg>',userPlus:'<svg></svg>',demo:true};
test('source card has real overlay/name buttons, original hierarchy and no marketing shortcuts',()=>{
 const out=ui.card({...context,context:'near'});
 for(const name of ['card-open','card-photo','photo-shade','card-distance','person-details','card-name-row','rating-line'])assert.ok(out.includes(`class="${name}"`));
 assert.doesNotMatch(out,/data-action="(?:request|chat)"/);
 assert.ok(out.includes('&quot; onerror=&quot;'));
 assert.doesNotMatch(out,/<script>|<img>/);
});
test('full profile and gallery are source route structures, never duplicated modal/footer compositions',()=>{
 const profile=ui.profile(context),gallery=ui.gallery(context);
 assert.match(profile,/^<main class="full-profile profile-route"/);
 assert.match(profile,/class="full-name-row"/);assert.match(profile,/class="full-profile-actions"/);
 assert.match(gallery,/class="ig-tile"><button/);assert.match(gallery,/grid/);
 assert.doesNotMatch(profile+gallery,/<dialog|<nav|member-profile-view|profile-navigation/);
 assert.doesNotMatch(gallery,/delete-photo|route-gallery-upload/);
 assert.match(ui.gallery({...context,own:true,config:{mediaUploadEnabled:true}}),/id="route-gallery-upload"/);
});
test('private comments stay absent for strangers and visible for owners/accepted friends only',()=>{
 const view={photos:context.photos,index:0,comments:[{sender_name:'เพื่อน',body:'private-fixture'}]};
 assert.doesNotMatch(ui.post({...context,view}),/private-fixture|class="post-comments"/);
 assert.match(ui.post({...context,view,own:true}),/private-fixture/);
 assert.match(ui.post({...context,view,relation:{status:'accepted'}}),/private-fixture/);
 assert.match(ui.post({...context,view}),/<button disabled>ส่ง<\/button>/);
});
test('old card/profile/gallery adapter selectors are removed, not patched with another overlay',()=>{
 const legacy=['app/social.css','app/restoration.css','app/near-v91.css'].map(p=>readFileSync(p,'utf8')).join('\n');
 assert.doesNotMatch(legacy,/\.member-profile|\.person-card\.context|#profile-dialog\s*\{/);
 const source=readFileSync('app/near-components.css','utf8');
 assert.match(source,/\.full-profile-info/);assert.match(source,/\.ig-tile > button:first-child/);
 assert.match(source,/\.manage-photo-grid/);assert.doesNotMatch(source,/member-profile-info/);
});
