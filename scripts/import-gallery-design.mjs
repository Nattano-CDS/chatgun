// Mechanical import of the owner-approved CSS, scoped to Gallery only.
import {readFileSync,writeFileSync} from 'node:fs';
const html=readFileSync('docs/gallery-approved/reference/chatgun-gallery-design/chatgun_gallery_ux_prototype.html','utf8');
let css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
css=css.replace(/:root/g,'.gallery-experience').replace(/font-family:Arial,"Noto Sans Thai",Tahoma,sans-serif/,'font-family:"Noto Sans Thai",sans-serif');
// Every selector, including responsive rules, is isolated from the NEAR shell.
css=css.replace(/([^{}]+)\{/g,(match,selectors)=>{
  if(selectors.trim().startsWith('@'))return match;
  return selectors.split(',').map(s=>{s=s.trim();return s.startsWith('.gallery-experience')?s:'.gallery-experience '+s;}).join(',')+'{';
});
css+='\n.gallery-experience{min-height:100dvh;padding-bottom:100px;background:var(--bg);color:var(--ink)}\n.gallery-experience .tile img{width:100%;height:100%;object-fit:cover;display:block}.gallery-experience .avatar img{height:100%;width:100%;object-fit:cover}.gallery-experience .breadcrumbs button{background:none;border:0;padding:0;min-height:44px;color:inherit}.gallery-experience .tile-owner-controls{display:flex;gap:6px;flex-wrap:wrap;font-size:11px}.gallery-experience .tile-owner-controls button{min-height:44px;background:white;border:1px solid var(--line);border-radius:10px}.gallery-experience .review-status{color:#775e8a}.gallery-experience .thumb-small .remove{min-width:44px;min-height:44px}.gallery-experience .upload-picker:focus-within{outline:3px solid #a58cfc;outline-offset:3px}.gallery-experience .upload-picker input{display:block;position:absolute;width:1px;height:1px;opacity:0}.gallery-experience [hidden]{display:none!important}.gallery-experience .quota-fill{max-width:100%}.gallery-experience .brand{color:var(--ink)}\n';
css+='\n.gallery-experience .lightbox-image img{width:100%;height:100%;object-fit:contain;max-height:90vh}.gallery-experience .lightbox-nav{position:static;transform:none;width:auto}.gallery-experience .lightbox button{min-height:44px;min-width:44px}.gallery-experience .upload-file-state{position:absolute;bottom:0;left:0;right:0;background:#fffD;color:#61566c;font-size:11px;padding:5px}.gallery-experience .lightbox-art{display:flex;align-items:center}.gallery-experience .post-comments p{display:inline}.gallery-experience .album-management{margin-top:24px;padding:16px;background:white;border:1px solid var(--line);border-radius:14px}\n';
css+='\n.gallery-experience{padding:0 0 100px;margin:0;width:100%}.gallery-experience .page h2{font-weight:700}.gallery-experience .like-pill svg{width:12px;height:12px}.gallery-experience .tile{width:100%}.gallery-experience .scope-icon{align-self:center}\n';
for(let i=0;i<=10;i++)css+=`\n.gallery-experience .quota-fill.used-${i}{width:${i*10}%}`;
css+='\n.gallery-experience .lightbox{z-index:10000}.gallery-experience .lightbox-shell{min-height:0;margin:0;border:0}.gallery-experience .lightbox-art img{width:100%;height:100%;object-fit:contain;max-height:90vh}.gallery-experience .lightbox-arrows{padding:0;position:static;transform:none;width:auto}.gallery-experience .lightbox-arrows button{min-width:44px;min-height:44px;border-radius:9px}\n';
css+='\n.gallery-experience .brand{min-height:44px}.gallery-experience .round-soft{min-width:44px;min-height:44px}.gallery-experience .breadcrumbs button,.gallery-experience .tile-owner-controls button{min-width:44px}.gallery-experience .lightbox-like{min-height:44px}.gallery-experience .comment-compose button{min-width:44px}\n';
css+='\n.gallery-experience .breadcrumbs{height:16px;align-items:center}.gallery-experience .field-label span{color:#a296ae;font-weight:400}\n';
// Owner-approved UX remediation: keep prototype tokens/components; compact only
// the upload composition. Sticky actions reserve the NEAR navigation clearance.
css+=`\n.gallery-experience .thumb-small.saved{outline:2px solid var(--lime)}
.gallery-experience .upload-file-state{max-height:65%;overflow:auto;overflow-wrap:anywhere}
.gallery-experience .thumb-small{width:112px;height:112px;flex:none}
.gallery-experience .thumb-strip{overflow-x:auto;gap:10px;padding:4px}
.gallery-experience [data-upload-success]{padding:12px;background:var(--lavender,#f5efff);border-radius:14px}
.gallery-experience .action-bar{position:fixed;left:0;right:0;bottom:calc(72px + env(safe-area-inset-bottom));z-index:45;display:flex;flex-wrap:wrap;justify-content:center;background:#fff;padding:10px 16px;box-shadow:0 -3px 16px #21143912;border-top:1px solid var(--line);gap:8px}
.gallery-experience [data-upload-summary]{flex-basis:100%;text-align:center;font-size:12px;color:var(--muted)}
.gallery-experience .upload-panel[data-complete=true] .dropzone,.gallery-experience .upload-panel[data-complete=true] .form-row,.gallery-experience .upload-panel[data-complete=true] .privacy-note,.gallery-experience .upload-panel[data-complete=true] [data-upload-cancel]{display:none}
.gallery-experience .upload-panel{margin-bottom:70px}
.gallery-experience .upload-limits{padding:12px 20px;background:#fff;border-bottom:1px solid var(--line)}
.gallery-experience .upload-limits .quota{margin:6px 0}
.gallery-experience .upload-limits .quota-helper{margin:6px 0;font-size:12px}
.gallery-experience .lightbox-caption,.gallery-experience .comment{overflow-wrap:anywhere}
.gallery-experience .lightbox-side{min-height:0;overflow:hidden;display:flex;flex-direction:column}
.gallery-experience .lightbox-shell{height:90dvh;grid-template-rows:minmax(0,1fr)}
.gallery-experience .lightbox-top,.gallery-experience .lightbox-like,.gallery-experience .comment-compose,.gallery-experience .lightbox-arrows{flex-shrink:0}
.gallery-experience .lightbox-caption{max-height:120px;overflow-y:auto;flex-shrink:0}
.gallery-experience .comment-group{display:flex;flex-direction:column;flex:1;min-height:0}
.gallery-experience .post-comments{overflow-y:auto;min-height:0}
.gallery-experience .lightbox-art{position:relative;min-width:0;background:#eee9f5}
.gallery-experience .lightbox-art img{object-fit:contain}
.gallery-experience .image-load-status{position:absolute;inset:0;display:grid;place-content:center;padding:24px;text-align:center;pointer-events:none}
@media(max-width:800px){
body[data-person-route=upload] #profile-dialog .gallery-experience{padding-bottom:calc(160px + env(safe-area-inset-bottom))}
.gallery-experience .topbar{height:56px;padding:0 16px;justify-content:space-between}
.gallery-experience .page{padding:16px}
.gallery-experience .page-head{margin:12px 0 16px}
.gallery-experience .page-head h2{font-size:24px}
.gallery-experience .page-intro{font-size:13px}
.gallery-experience .dropzone{padding:12px;min-height:0;gap:4px}
.gallery-experience .drop-icon{width:36px;height:36px;margin-bottom:6px}
.gallery-experience .dropzone p{margin:6px 0 12px;font-size:12px}
.gallery-experience .form-area{padding:14px}
.gallery-experience .form-row{margin-bottom:12px}
.gallery-experience .caption-field{min-height:66px}
.gallery-experience .privacy-note{padding:10px;margin-bottom:12px}
.gallery-experience .quota{margin-top:10px}
.gallery-experience .quota-helper{margin:6px 0;font-size:12px}
.gallery-experience .action-bar{position:fixed;left:0;right:0;bottom:calc(72px + env(safe-area-inset-bottom));z-index:45;background:#fff;padding:10px 16px;box-shadow:0 -3px 16px #21143912;border-top:1px solid var(--line);gap:8px;justify-content:flex-end}
.gallery-experience .action-bar button{min-height:44px}
.gallery-experience .lightbox{padding:8px;align-items:center}
.gallery-experience .lightbox-shell{display:grid;height:calc(100dvh - 16px);max-height:calc(100dvh - 16px);overflow:hidden;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(140px,32dvh) minmax(0,1fr)}
.gallery-experience .lightbox-art{height:100%;min-height:0}
.gallery-experience .lightbox-caption{max-height:72px;margin:8px 0}
.gallery-experience .lightbox-art img{max-height:100%;object-fit:contain}
.gallery-experience .comment-compose{position:sticky;bottom:0;background:white;z-index:2}
body[data-keyboard-open=true][data-person-route=upload] .sidebar{visibility:hidden}
body[data-keyboard-open=true] .gallery-experience .action-bar{position:static;box-shadow:none}
}
`;
css=css.replaceAll('.gallery-experience',':is(#profile-dialog,#app) .gallery-experience');
writeFileSync('app/gallery-approved.css',css);
