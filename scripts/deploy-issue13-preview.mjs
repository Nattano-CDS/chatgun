// Pages requires a file literally named wrangler.jsonc in the deployment cwd.
// Package a separate isolated staging workspace; never rebind the chatgun project.
import {cpSync,mkdtempSync,copyFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated staging acknowledgement required');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(JSON.parse(readFileSync('dist/release.json')).commit!==sha)throw Error('Rebuild current commit before deployment');
const directory=mkdtempSync(join(tmpdir(),'chatgun-issue13-preview-'));
copyFileSync('wrangler.issue13.jsonc',join(directory,'wrangler.jsonc'));
cpSync('dist',join(directory,'dist'),{recursive:true});
cpSync('functions',join(directory,'functions'),{recursive:true});
execFileSync('npx',['wrangler@4.151.1','pages','deploy','dist','--project-name=chatgun-issue13-staging','--branch=issue13',`--commit-hash=${sha}`,'--commit-dirty=true'],{cwd:directory,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'23017b53386fb67fc62a52cdd017454c'},stdio:'inherit'});
