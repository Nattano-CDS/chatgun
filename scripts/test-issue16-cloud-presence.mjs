// Authenticated synthetic sessions on the isolated project only. Not an OAuth E2E claim.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {issueSession,unixTime} from '../functions/_lib/db.js';
const origin='https://issue13.chatgun-issue13-staging.pages.dev',account='23017b53386fb67fc62a52cdd017454c',database='275d9820-6aec-494a-8bb5-b7ed9b8b74cc',output='docs/issue-16/cloud-presence-results.json';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const response=await fetch(origin+'/api/social/config');
let config;try{config=await response.json();}catch{}
if(response.status!==200||config?.onlineStatusEnabled!==true){
  writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),origin,status:'BLOCKED',reason:'Authenticated Functions E2E prerequisite unavailable',httpStatus:response.status,fixturesCreated:0,productionWrites:0},null,2)+'\n');
  console.error('BLOCKED: configuration API unavailable or candidate presence flag not active; no fixtures created.');process.exit(2);
}
const release=await(await fetch(origin+'/release.json')).json();
if(process.env.EXPECTED_SHA)assert.equal(release.commit,process.env.EXPECTED_SHA);
if(!process.argv.includes('--component-fixtures')){
  writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),origin,status:'BLOCKED',reason:'Genuine authorized human account journey required; synthetic component fixtures are not real OAuth evidence',configApiAvailable:true,fixturesCreated:0,productionWrites:0},null,2)+'\n');
  console.error('BLOCKED: continue with authorized human OAuth accounts. Synthetic component tests require explicit --component-fixtures and cannot establish real-user readiness.');process.exit(2);
}
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function cf(path,body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(j.success,true);return j.result;}
const project=await cf('/pages/projects/chatgun-issue13-staging');assert.equal(project.deployment_configs.preview.d1_databases.DB.id,database);
async function query(sql,params=[]){return(await cf(`/d1/database/${database}/query`,{sql,params}))[0];}
const db={prepare(sql){let params=[];return {bind(...p){params=p;return this;},async run(){return query(sql,params);}};},async batch(statements){const rows=[];for(const statement of statements)rows.push(await statement.run());return rows;}};
const run='issue16-'+randomUUID(),ids={},sessions={},checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push({name,status:'PASS'});};
function headers(actor){const s=sessions[actor];return {cookie:`__Host-cg_session=${s.token}; __Host-cg_csrf=${s.csrf}`,origin,'content-type':'application/json','x-csrf-token':s.csrf};}
async function call(actor,body,extra={}){return fetch(origin+'/api/social/online'+(body?'':'?users='+ids.owner),{method:body?'POST':'GET',headers:{...headers(actor),...extra},...(body?{body:JSON.stringify(body)}:{})});}
const online=async()=> (await(await call('viewer')).json()).statuses[ids.owner];
const heartbeat=async(tabId='abcdefghijklmnop')=>call('owner',{action:'heartbeat',foreground:true,tabId});
try{
  for(const role of ['owner','viewer']){
    const id=run+'-'+role;ids[role]=id;
    await query("INSERT INTO users(id,status,created_at,updated_at)VALUES(?,'active',?,?)",[id,unixTime(),unixTime()]);
    await query("INSERT INTO age_assurance_events(id,user_id,age_band,method,notice_version,declared_at)VALUES(?,?,'adult_18_plus','self_declaration','isolated-test',?)",[id+'-adult',id,unixTime()]);
    await query('INSERT INTO member_profiles(user_id,age_assurance_id,name,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at)VALUES(?,?,?,1,0,0,10,1,?,?)',[id,id+'-adult','ผู้ทดสอบระบบ',unixTime(),unixTime()]);
    sessions[role]=await issueSession(db,id);
  }
  check('anonymous heartbeat denied',(await fetch(origin+'/api/social/online')).status===401);
  check('missing CSRF denied',(await call('owner',{action:'preference',enabled:true},{'x-csrf-token':''})).status===403);
  check('default opt-out',(await online())===false);
  await call('owner',{action:'preference',enabled:true});check('authenticated heartbeat accepted',(await heartbeat()).status===200);
  check('authorized boolean Online',(await online())===true);
  const payload=await(await call('viewer')).json();check('no raw timestamps or sessions disclosed',!/(touched|last_seen|token|latitude|longitude|expires)/.test(JSON.stringify(payload)));
  await query('UPDATE member_presence_leases SET touched_at=? WHERE user_id=?',[unixTime()-111,ids.owner]);check('TTL expires',(await online())===false);await heartbeat();
  await heartbeat('secondtababcdefghi');await call('owner',{action:'offline',tabId:'abcdefghijklmnop'});check('another active tab remains Online',(await online())===true);
  await call('owner',{action:'preference',enabled:false});check('opt-out immediate',(await online())===false);
  await call('owner',{action:'preference',enabled:true});await heartbeat();
  await query('INSERT INTO social_blocks(blocker_user_id,blocked_user_id,created_at)VALUES(?,?,?)',[ids.viewer,ids.owner,unixTime()]);check('blocked viewer denied',(await online())===false);
  await query('DELETE FROM social_blocks WHERE blocker_user_id=? AND blocked_user_id=?',[ids.viewer,ids.owner]);
  await query('UPDATE member_profiles SET discovery_visible=0 WHERE user_id=?',[ids.owner]);check('hidden profile suppressed',(await online())===false);
  await query('UPDATE member_profiles SET discovery_visible=1 WHERE user_id=?',[ids.owner]);
  const logout=await fetch(origin+'/api/auth/logout',{method:'POST',headers:headers('owner'),body:'{}'});check('logout accepted',logout.status===200);check('logout immediately offline',(await online())===false);check('revoked session heartbeat denied',(await heartbeat()).status===401);
  check('foreign keys intact',(await query('SELECT COUNT(*) n FROM pragma_foreign_key_check')).results[0].n===0);
  writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),commit:release.commit,origin,status:'PASS',authenticatedFunctionsVerified:true,passed:checks.length,checks,productionWrites:0},null,2)+'\n');
}finally{
  // Retain exact run provenance, but revoke all temporary sessions and suppress test accounts.
  for(const id of Object.values(ids)){await query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=?',[unixTime(),id]);await query("UPDATE users SET status='disabled' WHERE id=?",[id]);}
}
