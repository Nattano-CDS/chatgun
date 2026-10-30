import assert from'node:assert/strict';
export function assertFullSystemRelease({release,migrationCount,approval}){
 assert.ok(migrationCount>=Number(release.requiredD1MigrationNumber||15),'Production schema is not ready; separate migration approval required');
 if(Number(release.requiredD1MigrationNumber||15)<17)return;
 assert.ok(approval&&approval.sha===release.commit&&approval.humanUatPassed===true&&approval.rolloutApproved===true&&approval.productionMigrationsApproved===true,'Consolidated genuine UAT and exact-SHA rollout/migration approval are required; keep owner pilot stable');
}

// Separate owner-only Production-UAT path explicitly approved by the owner.
// This is not a full Social launch or evidence that human UAT has already passed.
export function assertOwnerProductionUatRelease({release,migrationCount,approval,vars,now=Date.now()}){
 assert.match(release.commit,/^[a-f0-9]{40}$/);
 assert.equal(release.releaseMode,'controlled-beta');
 assert.equal(Number(release.requiredD1MigrationNumber),17);
 assert.equal(migrationCount,17);
 assert.equal(approval?.scope,'line-owner-production-uat');
 assert.equal(approval.sha,release.commit);
 for(const key of['rolloutApproved','productionMigrationsApproved','ownerOnly'])assert.equal(approval[key],true);
 for(const key of['humanUatPassed','publicLaunchApproved','realSocialActivationApproved','newInvitationsApproved','newRolesApproved'])assert.equal(approval[key],false);
 assert.ok(Number.isSafeInteger(approval.expiresAt)&&approval.expiresAt>Math.floor(now/1000),'Production-UAT approval expired');
 assert.equal(vars.OAUTH_LOGIN_ENABLED,'true');assert.equal(vars.OAUTH_ENABLED_PROVIDERS,'line');
 assert.equal(vars.MEDIA_QUARANTINE_ENABLED,'true');
 for(const key of['NEW_ACCOUNT_REGISTRATION_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','RATINGS_ENABLED','ACCOUNT_MODERATION_ENABLED','SENSITIVE_CONTENT_ENABLED','IDENTITY_VERIFICATION_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED','FRIEND_REQUESTS_ENABLED'])assert.equal(vars[key],'false','Owner Production-UAT cannot activate '+key);
}
