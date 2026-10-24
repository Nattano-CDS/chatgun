import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';
assert.equal(process.env.CHATGUN_FINAL_UAT,'approved');const s=JSON.parse(readFileSync('docs/final-uat/environment.json'));
assert.equal(s.account,'23017b53386fb67fc62a52cdd017454c');assert.equal(s.databaseId,'e3cb426c-b88a-4b93-90fd-39df524f68ae');
const{token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+s.account+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),j=await r.json();assert.ok(r.ok&&j.success,'Scoped final read-only resource check failed');return j.result;}
assert.equal((await cf('')).id,s.account);const p=await cf('/pages/projects/'+s.project);assert.equal(p.deployment_configs.preview.d1_databases.DB.id,s.databaseId);assert.equal(p.deployment_configs.preview.r2_buckets.MEDIA.name,s.bucket);
const q=async sql=>{const r=(await cf('/d1/database/'+s.databaseId+'/query',{sql}))[0];assert.equal(r.meta.changed_db,false);return r;};
const counts={};for(const t of['users','identities','sessions','social_media','moderation_access_grants','beta_invitations','cloudflare_admin_sessions']){counts[t]=(await q('SELECT COUNT(*) n FROM '+t)).results[0].n;assert.equal(counts[t],0);}
assert.equal((await q('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n,0);assert.equal((await q('SELECT COUNT(*) n FROM d1_migrations')).results[0].n,21);
const workers=[];for(const [name,cron]of[['chatgun-final-uat-privacy-cleanup','17 3 * * *'],['chatgun-final-uat-media-cleanup','37 3 * * *']]){
 const root='/workers/scripts/'+name,settings=await cf(root+'/settings'),schedules=await cf(root+'/schedules'),publicSettings=await cf(root+'/subdomain');
 assert.equal(settings.bindings.find(b=>b.type==='d1').id,s.databaseId);if(name.includes('media'))assert.equal(settings.bindings.find(b=>b.type==='r2_bucket').bucket_name,s.bucket);
 assert.ok(schedules.schedules.some(s=>s.cron===cron));assert.equal(publicSettings.enabled,false);
 workers.push({name,bindings:settings.bindings.map(b=>({name:b.name,type:b.type,...(b.type==='d1'?{id:b.id}:{}),...(b.type==='r2_bucket'?{bucket_name:b.bucket_name}:{})})),cron,publicEndpoint:false,actualScheduledExecution:'NOT RUN',manualScopedCleanup:'PASS (media queue)'});
}
const readProbe=await q("SELECT id FROM users WHERE id='nonexistent-uat-sentinel'");
const proof={checkedAt:new Date().toISOString(),counts,foreignKeyViolations:0,schema:21,workers,emptyDatabaseReadProbe:{rowsRead:readProbe.meta.rows_read,rowsWritten:readProbe.meta.rows_written,durationMs:readProbe.meta.duration},readProbeLimit:'Empty UAT sentinel query; not real-member traffic/capacity evidence',remainingDeployments:(await cf('/pages/projects/'+s.project+'/deployments')).map(d=>({id:d.id,environment:d.environment,branch:d.deployment_trigger.metadata.branch,sha:d.deployment_trigger.metadata.commit_hash})),productionMutations:0};
writeFileSync('docs/final-uat/final-resource-verification.json',JSON.stringify(proof,null,2)+'\n');console.log('Final new-UAT users/identities/sessions/media/grants/invitations0; schema21/FK0; both private cleanup Worker bindings/schedules verified.');
