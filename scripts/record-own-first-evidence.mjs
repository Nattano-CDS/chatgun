import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root='docs/issue-10-own-first',sha=process.env.EXPECTED_SHA;
assert.match(sha||'',/^[a-f0-9]{40}$/);
const json=p=>JSON.parse(readFileSync(`${root}/${p}`,'utf8')),text=p=>readFileSync(`${root}/${p}`,'utf8');
assert.match(text('unit.log'),/ℹ pass 101\nℹ fail 0/);
for(const [file,passed,skipped] of [['playwright-preview-final.log',67,35],['playwright-production.log',6,0]]){
 const log=text(file);assert.match(log,new RegExp(`\\n\\s*${passed} passed`));assert.doesNotMatch(log,/^\s*\d+ failed/m);
 if(skipped)assert.match(log,new RegExp(`\\n\\s*${skipped} skipped`));
}
const infra=json('infrastructure-check.json'),capture=json('production/capture.json'),assets=json('deployed-assets.json'),smoke=json('production-smoke.json');
for(const value of [infra.canonicalDeployment.sha,capture.commit,assets.sha,smoke.release.commit,json('package-check.json').sha])assert.equal(value,sha);
assert.equal(infra.canonicalDeployment.status,'success');assert.equal(capture.target,'https://chatgun.social');assert.deepEqual(capture.failures,[]);
assert.equal(infra.foreignKeyViolations,0);assert.equal(infra.databaseWrites,0);assert.equal(infra.productionR2Bindings,0);assert.equal(smoke.ok,true);
assert.ok(assets.assets.every(a=>a.match));
const geometry=json('geometry.json');assert.equal(geometry.length,30);assert.ok(geometry.every(g=>!g.widthDelta&&!g.heightDelta&&!g.yDelta));
const controlsEvidence=json('production-controls/results.json');assert.equal(controlsEvidence.commit,sha);assert.equal(controlsEvidence.origin,capture.target);
const controls=controlsEvidence.results;assert.equal(controls.length,3);assert.ok(controls.every(c=>c.result==='PASS'&&c.serverWrites===0&&c.apiInterception===false));
assert.ok(text('comparison.html').includes(sha));
const evidence={checkedAt:new Date().toISOString(),runtimeSHA:sha,productionURL:capture.target,deployment:infra.canonicalDeployment,
 tests:{unit:{passed:101,failed:0,skipped:0},previewBrowser:{passed:67,failed:0,skipped:35},productionBrowser:{passed:6,failed:0,skipped:0},additionalProductionControls:{passed:3,failed:0},protectedLiveScenariosNotRun:16},
 visuals:{viewports:capture.viewports,comparisons:36,measuredComponents:30,dimensionAndVerticalPositionDiscrepancies:0,pixelIdentityClaim:false,selfShortcutIsApprovedSourceException:true},
 safety:{databaseMutations:0,r2Mutations:0,productionMediaBound:false,stagingSeedResetOrCleanup:false,realUserActivation:false},
 assessment:{guardedFictionalFrontend:'GO',realUserBeta:'NO-GO',remaining:['Legal approval','Adult-assurance decisions','Location-risk acceptance','Moderation/scanning/appeals/emergency operations and backup operator','Intentionally unrun live authenticated scenarios']}};
writeFileSync(`${root}/test-evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
