// Reproducible source port. Read-only canonical runtime; removes obsolete
// adapter selectors before writing the canonical, unaliased component rules.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch();const page=await browser.newPage();
await page.goto(process.env.NEAR_URL||'http://127.0.0.1:5173/');
await page.locator('.photo-card').first().waitFor();
const roots=`person photo-card card-open card-photo photo-shade card-distance person-details person-name person-bio person-top card-name-row rating-line card-actions tags rate-button incoming-bell request-dot request-card request-decisions full-profile profile-route full-profile-image full-profile-shade full-profile-info full-name-row full-bio profile-facts profile-interests full-profile-actions profile-back profile-page-brand profile-gallery-top profile-gallery-button profile-rate page-header-identity gallery-page gallery-header gallery-back gallery-summary gallery-avatar gallery-facts gallery-interests gallery-actions gallery-demo gallery-upload ig-grid ig-tile delete-photo tile-likes gallery-post-page post-layout post-owner post-avatar lightbox-image post-social post-like post-comment post-comments lightbox-nav gallery-atlas profile-photo portrait-viewport no-photo people-management safety-actions primary secondary small icon-button empty panel profile-form blocked-users avatar upload-page upload-header upload-content upload-demo upload-profile-panel upload-cover upload-editor upload-kind photo-drop upload-caption upload-save upload-success upload-gallery-title manage-photo-grid cover-label upload-empty toolbar-brand sr-only`.split(' ');
roots.push('portrait-fallback','verify-cta','verify-badge','badge-info','badge-explainer','gallery-verified','gallery-badge-note');
const css=await page.evaluate(roots=>{
 const names=new Set(roots),base=new Set(['button','button:disabled','button:focus-visible','a','a:focus-visible','input','textarea','select','svg','h1','h2','p']);
 function visit(rules){return [...rules].map(r=>{
  if(r.type===CSSRule.STYLE_RULE){const selectors=r.selectorText.split(',').filter(s=>{
   const classes=[...s.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);
   return (classes.some(c=>names.has(c))||base.has(s.trim()))&&!classes.some(c=>/game|estate|pig-|pet-|chat-app|active-thread|auth-|modal|filter|near-|brand-caption/.test(c));
  }).map(s=>':is(#app,#profile-dialog) :where(.near-components) '+s.trim());
  return selectors.length?selectors.join(',')+' { '+r.style.cssText+' }\n':'';}
  if(r.type===CSSRule.MEDIA_RULE){const body=visit(r.cssRules);return body?'@media '+r.conditionText+' {\n'+body+'}\n':'';}return '';
 }).join('');}
 return [...document.styleSheets].map(s=>{try{return visit(s.cssRules)}catch{return ''}}).join('');
},roots);
// These selectors belonged to the former generic card/modal/gallery adapter.
const obsolete=/\.(?:person-card|photo-card|card-photo|card-open|photo-shade|card-distance|person-info|person-details|person-name|person-bio|person-meta|card-name-row|rating-line|card-actions|incoming-bell|request-dot|request-card|request-decisions|member-profile[\w-]*|profile-primary-actions|profile-navigation|dialog-profile|dialog-actions|gallery-open|gallery-header|gallery-back|gallery-summary|gallery-avatar|gallery-facts|gallery-interests|gallery-actions|gallery-demo|gallery-brand|ig-grid|ig-tile|tile-likes|gallery-post[\w-]*|post-layout|post-owner|post-avatar|lightbox-image|post-social|post-like|post-comment|post-comments|lightbox-nav|people-management|profile-form)(?![\w-])|#profile-dialog(?:[\s.#:[>]|$)|#profile-form|#profile-avatar|#gallery-settings-back|#app \.gallery-panel/;
for(const file of ['app/social.css','app/near-v91.css','app/restoration.css']){
 const input=execFileSync('git',['show','1873fd3c9aae5a0efc26fef47b98753d8fa31308:'+file],{encoding:'utf8'});
 const cleaned=await page.evaluate(({input,pattern})=>{
  const sheet=new CSSStyleSheet();sheet.replaceSync(input);const re=new RegExp(pattern);
  function split(selectors){let depth=0,start=0,result=[];for(let i=0;i<selectors.length;i++){const c=selectors[i];if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c===','&&!depth){result.push(selectors.slice(start,i));start=i+1;}}result.push(selectors.slice(start));return result;}
  function visit(rules){return [...rules].map(r=>{if(r.type===CSSRule.STYLE_RULE){const ss=split(r.selectorText).filter(s=>!re.test(s.replace(/:is\(#app,\s*#profile-dialog,\s*#asset-dialog\)\s*/g,'')));return ss.length?ss.join(',')+'{'+r.style.cssText+'}\n':'';}if(r.type===CSSRule.MEDIA_RULE){const child=visit(r.cssRules);return child?'@media '+r.conditionText+'{\n'+child+'}\n':'';}return r.cssText+'\n';}).join('');}return visit(sheet.cssRules);
 },{input,pattern:obsolete.source});
 await writeFile(file,cleaned);
}
const preflight=`/* NEAR 98bb83e source component rules, original order/media queries.
   No class aliases. Shared app/legacy rules for these components were removed.
   The small adapter below only covers branding, fiction notice and route mounting. */
:is(#app,#profile-dialog) :where(.near-components) {font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;line-height:1.5;}
:is(#app,#profile-dialog) :where(.near-components) :where(h1,h2,h3,p){margin:0;font-size:inherit;font-weight:inherit;}
:is(#app,#profile-dialog) :where(.near-components) :where(button,input,textarea,select){font:inherit;letter-spacing:inherit;color:inherit;}
:is(#app,#profile-dialog) :where(.near-components) button{background:transparent;border:0;border-radius:0;padding:0;min-height:0;box-shadow:none;}
:is(#app,#profile-dialog) :where(.near-components) svg{display:inline-block;vertical-align:middle;flex-shrink:0;}
`;
const adapter=`
/* ChatGun-only functional adapters; no card/profile/gallery geometry overrides. */
#profile-dialog.near-components{display:contents;}
#profile-dialog[hidden]{display:none;}
body[data-member-route] #app{display:contents;}
body[data-member-route] #app>main{display:none;}
body[data-person-route="profile"] .sidebar{display:none;}
body[data-own-gallery="true"] #app>main{max-width:none;padding:0;margin:0;width:100%;}
body[data-own-gallery="true"] #social-view>.toolbar,body[data-own-gallery="true"] #demo-banner,body[data-own-gallery="true"] #global-status{display:none;}
.near-components .page-header-identity .toolbar-brand{display:inline-flex;align-items:center;gap:5px;letter-spacing:-1px;}
.near-components .page-header-identity .toolbar-brand img{width:22px;height:22px;}
.near-components .upload-header .toolbar-brand img{width:22px;height:22px;}
.near-components .fixture-label{display:block;font-size:11px;opacity:.75;margin-top:6px;}
.near-components .post-owner>.fixture-label{margin:0 0 0 auto;white-space:nowrap;}
.near-components .post-owner>.post-report{padding:6px;display:flex;align-items:center;}
.near-components .gallery-upload-slot:empty{display:none;}
.near-components .upload-source-form{display:contents;}
.near-components .post-like.liked svg{fill:currentColor;}
.near-components .full-profile-info>.fixture-label{position:absolute;bottom:4px;right:22px;margin:0;font-size:10px;}
.near-components [data-image-error]{display:flex;align-items:center;justify-content:center;min-height:60px;background:#645574;color:white;}
.near-components [data-image-error]::after{content:attr(data-image-error);font-size:12px;padding:12px;}
/* Route host is not a dialog: original fixed layout covers the global footer. */
`;
// Scope is also needed when .near-components is the route host itself.
await writeFile('app/near-components.css',preflight.replaceAll(':is(#app,#profile-dialog) :where(.near-components)',':is(#app .near-components,#profile-dialog)')+css.replaceAll(':is(#app,#profile-dialog) :where(.near-components)',':is(#app .near-components,#profile-dialog)')+adapter);
await browser.close();console.log('Ported canonical component CSS; removed obsolete adapter selectors.');
