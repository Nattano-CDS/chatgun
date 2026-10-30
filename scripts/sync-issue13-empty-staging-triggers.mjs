// Development reconciliation ONLY, before the isolated test DB has any users.
// No tables/data/migration history are removed. Never run on the protected databases.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const account='23017b53386fb67fc62a52cdd017454c',id='275d9820-6aec-494a-8bb5-b7ed9b8b74cc';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const {token}=JSON.parse(execFileSync('npx',['wrangler@4.151.1','auth','token','--json'],{encoding:'utf8'}));
async function query(sql){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({sql})});const d=await r.json();if(!r.ok||!d.success)throw Error('D1 staging reconciliation failed');return d.result;}
if((await query('SELECT COUNT(*) n FROM users'))[0].results[0].n!==0)throw Error('Refusing development reconciliation on a populated database');
const source=readFileSync('migrations/0013_direct_chat_private_albums.sql','utf8');
for(const name of ['album_request_transition','direct_chat_spam_guard']){
  const definition=source.match(new RegExp('CREATE TRIGGER '+name+'[\\s\\S]*?\\nEND;'))?.[0];
  if(!definition)throw Error('Missing source trigger');
  await query(`DROP TRIGGER IF EXISTS ${name};\n${definition}`);
}
console.log(JSON.stringify({database:id,users:0,triggersReconciled:['album_request_transition','direct_chat_spam_guard'],tablesDeleted:0,migrationHistoryUnchanged:true}));
