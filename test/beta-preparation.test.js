import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import privacy from '../workers/privacy-cleanup.js';import {drainMediaDeletionQueue} from '../workers/media-cleanup.js';
test('prepared Production cleanup is inert until explicit enablement and schedule approval',async()=>{
  for(const name of ['cleanup','media-cleanup']){
    const cfg=JSON.parse(readFileSync(`wrangler.${name}-production-prepared.jsonc`));assert.deepEqual(cfg.triggers.crons,[]);assert.equal(cfg.workers_dev,false);assert.equal(cfg.preview_urls,false);assert.equal(Object.values(cfg.vars)[0],'false');assert.equal(cfg.d1_databases[0].database_id,'9738a051-d914-42d0-8e7b-8098ef2b959d');
  }
  const DB={prepare(){throw Error('disabled worker must not touch data');}};
  await privacy.scheduled({scheduledTime:1},{DB,RETENTION_CLEANUP_ENABLED:'false'},{waitUntil(){throw Error('must not schedule deletes');}});
  assert.equal((await drainMediaDeletionQueue({DB,MEDIA_CLEANUP_ENABLED:'false'})).disabled,true);
});
test('limited owner-pilot policies match confirmed operator and disclosed 18+ scope',()=>{
  for(const file of ['privacy.html','terms.html','data-deletion.html']){
    const html=readFileSync(file,'utf8');assert.match(html,/เทพกร ทาโน/);assert.match(html,/natttano@outlook.com/);assert.match(html,/data-policy-version=/);assert.match(html,/20 ตุลาคม 2026/);
  }
  const privacyHtml=readFileSync('privacy.html','utf8');assert.match(privacyHtml,/18–19/);assert.match(privacyHtml,/public_profile/);assert.match(privacyHtml,/ไม่ใช่การตรวจสอบอายุอย่างอิสระ/);assert.match(privacyHtml,/ไม่แสดงเวลาที่พบล่าสุด/);
});
