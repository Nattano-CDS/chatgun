import assert from'node:assert/strict';
export function assertFullSystemRelease({release,migrationCount,approval}){
 assert.ok(migrationCount>=Number(release.requiredD1MigrationNumber||15),'Production schema is not ready; separate migration approval required');
 if(Number(release.requiredD1MigrationNumber||15)<17)return;
 assert.ok(approval&&approval.sha===release.commit&&approval.humanUatPassed===true&&approval.rolloutApproved===true&&approval.productionMigrationsApproved===true,'Consolidated genuine UAT and exact-SHA rollout/migration approval are required; keep owner pilot stable');
}
