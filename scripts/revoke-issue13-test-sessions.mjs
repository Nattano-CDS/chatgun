// Revoke only disposable credentials from the new isolated synthetic database.
// This is not data cleanup: all profiles, albums, messages and owner fixtures remain.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const account='23017b53386fb67fc62a52cdd017454c',db='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function query(sql,params=[]){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({sql,params})});const d=await r.json();if(!r.ok||!d.success)throw Error('Isolated session revocation failed');return d.result[0];}
if((await query("SELECT COUNT(*) n FROM users WHERE id NOT LIKE 'issue13-%'")).results[0].n!==0)throw Error('Unexpected users in isolated database');
const result=await query("UPDATE sessions SET revoked_at=? WHERE revoked_at IS NULL AND user_id LIKE 'issue13-%'",[Math.floor(Date.now()/1000)]);
const left=(await query('SELECT COUNT(*) n FROM sessions WHERE revoked_at IS NULL')).results[0].n;if(left!==0)throw Error('Sessions remain active');
const evidence={database:db,revoked:Number(result.meta?.changes||0),activeSessions:0,usersDeleted:0,protectedStagingTouched:false};
writeFileSync((process.env.RELEASE_EVIDENCE_DIR||'docs/issue-13')+'/test-session-revocation.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
