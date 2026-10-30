import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFullSystemRelease,assertOwnerProductionUatRelease} from '../scripts/lib/full-system-release-gate.mjs';
import {ownerPilotVars} from '../scripts/lib/owner-pilot-release.mjs';
const sha='a'.repeat(40),release={commit:sha,releaseMode:'controlled-beta',requiredD1MigrationNumber:17};
const approval=()=>({scope:'line-owner-production-uat',sha,rolloutApproved:true,productionMigrationsApproved:true,ownerOnly:true,humanUatPassed:false,publicLaunchApproved:false,realSocialActivationApproved:false,newInvitationsApproved:false,newRolesApproved:false,expiresAt:Math.floor(Date.now()/1000)+3600});
const vars=()=>ownerPilotVars({versions:{adultNotice:'v1',terms:'v1',privacy:'v1'}});
test('explicit Production-UAT approval is not a fabricated full-system UAT pass',()=>{
 const a=approval();assert.throws(()=>assertFullSystemRelease({release,migrationCount:17,approval:a}));
 assert.doesNotThrow(()=>assertOwnerProductionUatRelease({release,migrationCount:17,approval:a,vars:vars()}));
});
test('owner-only Production-UAT rejects every social/public activation and unapproved grant',()=>{
 for(const key of['NEW_ACCOUNT_REGISTRATION_ENABLED','PUBLIC_DISCOVERY_ENABLED','MESSAGING_ENABLED','PRESENCE_ENABLED','MEDIA_UPLOAD_ENABLED','RATINGS_ENABLED','ACCOUNT_MODERATION_ENABLED','SENSITIVE_CONTENT_ENABLED','IDENTITY_VERIFICATION_ENABLED','EMAIL_OTP_ENABLED','MOBILE_OTP_ENABLED','DEMO_MODE_ENABLED','DEMO_AUTO_START_ENABLED','FRIEND_REQUESTS_ENABLED'])assert.throws(()=>assertOwnerProductionUatRelease({release,migrationCount:17,approval:approval(),vars:{...vars(),[key]:'true'}}));
 for(const key of['humanUatPassed','publicLaunchApproved','realSocialActivationApproved','newInvitationsApproved','newRolesApproved'])assert.throws(()=>assertOwnerProductionUatRelease({release,migrationCount:17,approval:{...approval(),[key]:true},vars:vars()}));
});
test('owner Production-UAT requires current exact SHA, approved schema, LINE-only and quarantine',()=>{
 for(const invalid of[null,{...approval(),sha:'b'.repeat(40)},{...approval(),expiresAt:0},{...approval(),ownerOnly:false}])assert.throws(()=>assertOwnerProductionUatRelease({release,migrationCount:17,approval:invalid,vars:vars()}));
 assert.throws(()=>assertOwnerProductionUatRelease({release,migrationCount:15,approval:approval(),vars:vars()}));
 for(const changed of[{OAUTH_ENABLED_PROVIDERS:'google,line'},{MEDIA_QUARANTINE_ENABLED:'false'}])assert.throws(()=>assertOwnerProductionUatRelease({release,migrationCount:17,approval:approval(),vars:{...vars(),...changed}}));
});
