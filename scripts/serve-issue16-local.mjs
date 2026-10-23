// Local-only integration harness: real handlers and SQLite migrations, no remote writes.
import {createServer} from 'node:https';
import {readFileSync,existsSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,extname} from 'node:path';
import {TestD1,environment} from '../test/helpers/d1.js';
import {issueSession,unixTime} from '../functions/_lib/db.js';
import {onRequest as social} from '../functions/api/social/[[path]].js';
import {onRequest as auth} from '../functions/api/auth/[[path]].js';
import {onRequestGet as health} from '../functions/api/health.js';
const db=new TestD1(),now=unixTime(),sessions={},fullSystem=process.env.CHATGUN_FULL_SYSTEM_LOCAL==='true',objects=new Map();
const tls=mkdtempSync(resolve(tmpdir(),'chatgun-issue16-local-tls-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',tls+'/key.pem','-out',tls+'/cert.pem','-subj','/CN=localhost','-days','1'],{stdio:'pipe'});
const tlsOptions={key:readFileSync(tls+'/key.pem'),cert:readFileSync(tls+'/cert.pem')};
for(const width of [390,768,1440])for(const [kind,name] of [['viewer','ผู้ทดสอบระบบผู้ชม'],['owner','ผู้ทดสอบชื่อภาษาไทยยาวสำหรับตรวจการตัดบรรทัด'],['other','ผู้ทดสอบบัญชีอื่น'],...(fullSystem?[['moderator','ผู้ตรวจระบบแยก'],['held','บัญชีจำลองที่พักสิทธิ์ตามอายุ']]:[])]){
  const id=kind+width;
  db.exec(`INSERT INTO users(id,display_name,status,created_at,updated_at)VALUES('${id}','${name}','active',${now},${now});
    INSERT INTO age_assurance_events VALUES('${id}-adult','${id}','adult_18_plus','self_declaration','local-test',${now},NULL);
    INSERT INTO member_profiles(user_id,age_assurance_id,name,discovery_visible,latitude,longitude,accuracy,located_at,created_at,updated_at)
      VALUES('${id}','${id}-adult','${name}',1,0,0,10,${now},${now},${now});`);
  sessions[id]=await issueSession(db,id);
  if(fullSystem)await db.prepare("INSERT INTO beta_enrollments(user_id,status,created_at,activated_at)VALUES(?,'active',?,?)").bind(id,now,now).run();
  // A local-only correction of a legacy adult declaration, not youth admission.
  if(kind==='held')await db.prepare("INSERT INTO member_age_safety_holds(user_id,age_band,state,notice_version,declared_at,updated_at)VALUES(?,'13_17','held','local-only',?,?)").bind(id,now,now).run();
  if(kind==='owner'||kind==='moderator')for(const role of ['report_reviewer','safety_admin'])await db.prepare('INSERT INTO moderation_access_grants(id,user_id,role,grant_reason,granted_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id+'-'+role,id,role,'Local-only browser authorization fixture',now,now+86400).run();
}
writeFileSync('/tmp/chatgun-issue16-local-sessions.json',JSON.stringify(sessions),{mode:0o600});
const base={...environment(db),SOCIAL_APP_ENABLED:'true',PRESENCE_ENABLED:'true',PUBLIC_DISCOVERY_ENABLED:'true',MESSAGING_ENABLED:'true',MODERATION_TOOLS_ENABLED:'true',ACCOUNT_MODERATION_ENABLED:'true',MEDIA_UPLOAD_ENABLED:'false',RATINGS_ENABLED:'false',IDENTITY_VERIFICATION_ENABLED:'false',OAUTH_LOGIN_ENABLED:'false',NEW_ACCOUNT_REGISTRATION_ENABLED:'false',DEMO_MODE_ENABLED:'false',DEMO_AUTO_START_ENABLED:'false'};
if(fullSystem)Object.assign(base,{BETA_ENROLLMENT_REQUIRED:'true',MEDIA_UPLOAD_ENABLED:'true',MEDIA_QUARANTINE_ENABLED:'true',RATINGS_ENABLED:'true',MEDIA:{async put(key,bytes){objects.set(key,new Uint8Array(bytes));},async head(key){return objects.has(key)?{}:null;},async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){objects.delete(key);}}});
const dist=resolve('dist'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
for(const [port,enabled] of [[8797,true],[8798,false]])createServer(tlsOptions,async(req,res)=>{
  try{
    const url=new URL(req.url,`https://localhost:${port}`);
    if(url.pathname.startsWith('/api/')){
      const parts=[];for await(const part of req)parts.push(part);
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
      const env=enabled?base:{...base,SOCIAL_APP_ENABLED:'false',PRESENCE_ENABLED:'false',MESSAGING_ENABLED:'false',PUBLIC_DISCOVERY_ENABLED:'false'};
      const response=url.pathname==='/api/health'?health():url.pathname.startsWith('/api/social/')?await social({request,env}):await auth({request,env});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let path=url.pathname;
    if(path==='/'||path==='/app/'||path.startsWith('/app/people/')||path.startsWith('/app/me/')||path==='/app/photos')path='/app/index.html';
    else if(!extname(path))path+='.html';
    const file=resolve(dist,'.'+path);
    if(!file.startsWith(dist+'/')||!existsSync(file)){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(readFileSync(file));
  }catch(error){console.error('local_harness_error',error.name);res.writeHead(500);res.end('Local test handler failed');}
}).listen(port,'localhost',()=>console.log(`Local integration server localhost:${port}; synthetic test records only`));
