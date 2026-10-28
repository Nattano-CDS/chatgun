import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const FINAL_UAT_ACCOUNT = '23017b53386fb67fc62a52cdd017454c';
export const FINAL_UAT_PROJECT = 'chatgun-final-uat';
export const FINAL_UAT_ORIGIN = 'https://uat.chatgun-final-uat.pages.dev';
export const FINAL_UAT_DATABASE = 'e3cb426c-b88a-4b93-90fd-39df524f68ae';
export const FINAL_UAT_BUCKET = 'chatgun-final-uat-media';
export const FINAL_UAT_APPLICATION_SHA = '4a7dee32c52bc474ee3cc50d13e293e66e771c1a';
export const OWNER_AUTHORIZATION_COMMENT = 6473130647;

export const PROPOSED_POLICY = Object.freeze({
  versions: {
    adultNotice: 'adult-social-always-on-uat-2026-10-28-rc4',
    terms: 'terms-social-always-on-uat-2026-10-28-rc4',
    privacy: 'privacy-social-always-on-uat-2026-10-28-rc4',
    deletion: 'deletion-social-always-on-uat-2026-10-28-rc4',
  },
  files: {
    'policies/final-uat/always-on-rc4/beta-notice.html': '40fc351a36f4152b1be777e36d80f2ce3ed758dcf3e8787ff498bba7d7d0f33a',
    'policies/final-uat/always-on-rc4/terms.html': '05e29c0bf3add6c9c265f4c0f88ef8a233d6671d615c74a3abef89f450236cc3',
    'policies/final-uat/always-on-rc4/privacy.html': 'e21371102282875933be8cf9349880c82dc9cd9a9762e6e34248907c6a0e79b1',
    'policies/final-uat/always-on-rc4/data-deletion.html': '7d880152078a479a42574bb846609911b67b857205c6c200dee98bff525915cd',
  },
});

const providers = new Set(['google', 'facebook', 'line']);
const referencePattern = /^[a-f0-9]{64}$/u;

function assistedKickoffWindow(window) {
  assert.equal(window.timezone, 'Asia/Bangkok');
  assert.match(window.start, /^\d{4}-\d{2}-\d{2}T(?:19|20|21):[0-5]\d:[0-5]\d\+07:00$/u);
  assert.match(window.end, /^\d{4}-\d{2}-\d{2}T(?:19|20|21|22):[0-5]\d:[0-5]\d\+07:00$/u);
  const start = Date.parse(window.start), end = Date.parse(window.end);
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && end > start);
  assert.equal(window.start.slice(0, 10), window.end.slice(0, 10));
  assert.ok(end - start <= 3 * 60 * 60 * 1000);
  assert.ok(end <= Date.parse(window.start.slice(0, 10) + 'T22:00:00+07:00'));
  return { start, end };
}

export function validateFinalUatSocialApproval(receipt) {
  assert.equal(receipt.scope, 'final-uat-always-on-private-social-location-chat-privacy');
  assert.equal(receipt.ownerAuthorizationComment, OWNER_AUTHORIZATION_COMMENT);
  assert.equal(receipt.policyApproved, true);
  assert.match(receipt.applicationSha, /^[a-f0-9]{40}$/u);
  assert.deepEqual(receipt.policyVersions, PROPOSED_POLICY.versions);
  assert.deepEqual(receipt.policyFiles, PROPOSED_POLICY.files);
  assert.equal(receipt.operations?.moderationCoverage, '19:00-22:00 Asia/Bangkok daily');
  assert.equal(receipt.operations?.no24x7OrBackupModeratorClaim, true);
  assert.equal(receipt.operations?.participantAccess, '24x7-until-explicit-owner-close-or-safety-kill-switch');
  assert.equal(receipt.operations?.accessRestrictedToModerationHours, false);
  assert.equal(receipt.operations?.automatic2200Shutdown, false);
  assert.equal(receipt.operations?.mediaEnabled, false);
  assert.equal(receipt.operations?.publicRegistrationEnabled, false);
  assert.equal(receipt.operations?.youthAdmissionEnabled, false);
  assert.equal(receipt.operations?.productionChangesAuthorized, false);
  assert.equal(receipt.operations?.retentionDecision, 'campaign-plus-7-days-logical-cleanup-with-recovery-caveat');
  assert.equal(receipt.operations?.recoveryCaveatAcknowledged, true);
  assert.equal(receipt.operations?.auditEvidenceRetentionDays, 90);
  assert.equal(receipt.operations?.auditEvidenceRetentionStartsAt, 'actual-campaign-close');
  assert.equal(receipt.operations?.auditEvidenceScope, 'strictly-necessary-minimized-security-audit-only');
  assert.equal(receipt.operations?.auditEvidencePhysicalBackupLimitClaimed, false);
  assert.equal(receipt.operations?.actualCampaignClosedAt, null);
  assert.equal(receipt.operations?.auditEvidenceExpiresAt, null);
  assert.equal(receipt.operations?.ownerAccountDeletionAuthorized, false);
  assistedKickoffWindow(receipt.window);
  assert.equal(receipt.participants?.length, 2);
  assert.deepEqual(receipt.participants.map(p => p.reference), ['A', 'B']);
  assert.equal(new Set(receipt.participants.map(p => p.providerAccountReferenceSha256)).size, 2);
  for (const participant of receipt.participants) {
    assert.ok(providers.has(participant.provider));
    assert.match(participant.providerAccountReferenceSha256, referencePattern);
    for (const field of ['genuineDistinctAdultConfirmed', 'age20PlusConfirmed', 'individualConsentConfirmed', 'providerTesterEligible', 'socialScopeConsent', 'locationScopeConsent', 'chatScopeConsent', 'presenceScopeConsent', 'privacyScopeConsent', 'disposableTestDataConsent', 'alwaysOnAccessConsent', 'outOfHoursModerationAcknowledged']) assert.equal(participant[field], true, `${participant.reference}.${field}`);
    assert.equal(participant.mediaConsentUsed, false);
  }
  assert.equal(typeof receipt.participants[1].accountDeletionConsent, 'boolean');
  return receipt;
}

export function finalUatSocialVars(receipt) {
  validateFinalUatSocialApproval(receipt);
  const enabledProviders = [...new Set(receipt.participants.map(p => p.provider))].sort().join(',');
  return {
    OAUTH_LOGIN_ENABLED: 'true', OAUTH_ENABLED_PROVIDERS: enabledProviders,
    NEW_ACCOUNT_REGISTRATION_ENABLED: 'false', BETA_INVITATION_REGISTRATION_ENABLED: 'true', BETA_ENROLLMENT_REQUIRED: 'true',
    ACCEPTANCE_FLOW_ENABLED: 'true', ADULT_ONBOARDING_ENABLED: 'true', SOCIAL_APP_ENABLED: 'true',
    ADULT_NOTICE_VERSION: receipt.policyVersions.adultNotice, TERMS_VERSION: receipt.policyVersions.terms, PRIVACY_VERSION: receipt.policyVersions.privacy,
    PUBLIC_DISCOVERY_ENABLED: 'true', MESSAGING_ENABLED: 'true', PRESENCE_ENABLED: 'true', RATINGS_ENABLED: 'false',
    MEDIA_UPLOAD_ENABLED: 'false', MEDIA_QUARANTINE_ENABLED: 'true', MODERATION_TOOLS_ENABLED: 'false', ACCOUNT_MODERATION_ENABLED: 'false',
    ELIGIBILITY_REVIEW_ENABLED: 'true', IDENTITY_VERIFICATION_ENABLED: 'false', SENSITIVE_CONTENT_ENABLED: 'false',
    EMAIL_OTP_ENABLED: 'false', MOBILE_OTP_ENABLED: 'false', LINE_EMAIL_ENABLED: 'false', FACEBOOK_EMAIL_ENABLED: 'false',
    FRIEND_REQUESTS_ENABLED: 'false', DEMO_MODE_ENABLED: 'false', DEMO_AUTO_START_ENABLED: 'false', PUBLIC_DEMO_CANARY_ENABLED: 'false',
    ADMIN_ACCESS_STANDALONE_ENABLED: 'false', ADMIN_CLOUDFLARE_ACCESS_REQUIRED: 'true',
    UAT_PRIVATE_COHORT_REQUIRED: 'true', UAT_ACCESS_MODE: 'always-on-until-explicit-close',
    UAT_AUDIT_RETENTION_DAYS: '90', UAT_AUDIT_RETENTION_START_MODE: 'actual-campaign-close',
  };
}

export function sanitizedCampaignSummary(receipt) {
  const vars = finalUatSocialVars(receipt);
  return {
    scope: receipt.scope,
    authorizationComment: receipt.ownerAuthorizationComment,
    policyVersions: receipt.policyVersions,
    window: receipt.window,
    participants: receipt.participants.map(p => ({ reference: p.reference, provider: p.provider, accountDeletionConsent: p.reference === 'B' ? p.accountDeletionConsent : false })),
    enabledProviders: vars.OAUTH_ENABLED_PROVIDERS.split(','),
    mediaEnabled: false,
    publicRegistrationEnabled: false,
    youthAdmissionEnabled: false,
    productionChangesAuthorized: false,
  };
}

export function hashAndRemovePrivateParticipantReferences(receipt) {
  const sanitized = structuredClone(receipt);
  for (const participant of sanitized.participants || []) {
    assert.equal(participant.providerAccountReferenceSha256, null, `${participant.reference}.providerAccountReferenceSha256 must be empty before finalization`);
    assert.equal(typeof participant.providerAccountReferencePrivate, 'string');
    const privateReference = participant.providerAccountReferencePrivate.trim();
    assert.ok(privateReference.length >= 3, `${participant.reference}.providerAccountReferencePrivate is required`);
    participant.providerAccountReferenceSha256 = createHash('sha256').update(`${participant.provider}\0${privateReference}`).digest('hex');
    participant.providerAccountReferencePrivate = '';
  }
  validateFinalUatSocialApproval(sanitized);
  return sanitized;
}
