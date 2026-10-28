import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const FINAL_UAT_ACCOUNT = '23017b53386fb67fc62a52cdd017454c';
export const FINAL_UAT_PROJECT = 'chatgun-final-uat';
export const FINAL_UAT_ORIGIN = 'https://uat.chatgun-final-uat.pages.dev';
export const FINAL_UAT_DATABASE = 'e3cb426c-b88a-4b93-90fd-39df524f68ae';
export const FINAL_UAT_BUCKET = 'chatgun-final-uat-media';
export const OWNER_AUTHORIZATION_COMMENT = 6473803567;

export const PROPOSED_POLICY = Object.freeze({
  versions: {
    adultNotice: 'adult-social-single-operator-dual-account-uat-2026-10-28-rc5',
    terms: 'terms-social-single-operator-dual-account-uat-2026-10-28-rc5',
    privacy: 'privacy-social-single-operator-dual-account-uat-2026-10-28-rc5',
    deletion: 'deletion-social-single-operator-dual-account-uat-2026-10-28-rc5',
  },
  files: {
    'policies/final-uat/single-operator-rc5/beta-notice.html': 'e4a8f77b607586b8c0ebd185d72857e0e0661e526cb6cfd0770247a7513c7de9',
    'policies/final-uat/single-operator-rc5/terms.html': 'd6d4035d772c9104bbbaaf96384a4768d6406ade93637e1fbed78f913a0f9f90',
    'policies/final-uat/single-operator-rc5/privacy.html': '73176011f94bfe987ae8e0c4ed3f09f862f43c38d5ee86d201afabfe9909201a',
    'policies/final-uat/single-operator-rc5/data-deletion.html': 'aaca1f6637f293f52bb2e2c7aa332bdba2a1ee052e8beccc39c8849408985d58',
  },
});

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
  assert.equal(receipt.scope, 'final-uat-single-operator-dual-account-always-on-private');
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
  assert.equal(receipt.operations?.humanOperatorCount, 1);
  assert.equal(receipt.operations?.authorizedIdentityCount, 2);
  assert.equal(receipt.operations?.functionalE2EClassification, 'single-operator-dual-account-not-independent-two-human-uat');
  assert.equal(receipt.operations?.externalProviderAccountDeletionAuthorized, false);
  assert.equal(receipt.operations?.productionLineIdentityDeletionAuthorized, false);
  assistedKickoffWindow(receipt.window);
  assert.equal(receipt.participants, undefined, 'Legacy two-human participant attestations are forbidden');
  assert.equal(receipt.operator?.reference, 'owner');
  for (const field of ['singleHumanOperatorConfirmed', 'age20PlusConfirmed', 'dualDeviceControlConfirmed', 'controlsAllAuthorizedIdentitiesConfirmed', 'socialScopeConsent', 'locationScopeConsent', 'chatScopeConsent', 'presenceScopeConsent', 'privacyScopeConsent', 'disposableTestDataConsent', 'alwaysOnAccessConsent', 'outOfHoursModerationAcknowledged']) assert.equal(receipt.operator[field], true, `operator.${field}`);
  assert.equal(receipt.identities?.length, 2);
  assert.deepEqual(receipt.identities.map(identity => [identity.reference, identity.provider]), [['A', 'line'], ['B', 'google']]);
  assert.equal(new Set(receipt.identities.map(identity => identity.providerAccountReferenceSha256)).size, 2);
  for (const identity of receipt.identities) {
    for (const legacy of ['genuineDistinctAdultConfirmed', 'individualConsentConfirmed', 'accountDeletionConsent']) assert.equal(identity[legacy], undefined, `${identity.reference}.${legacy} is a forbidden legacy human-consent field`);
    assert.match(identity.providerAccountReferenceSha256, referencePattern);
    for (const field of ['operatorControlConfirmed', 'providerTesterEligible', 'uatUseAuthorized']) assert.equal(identity[field], true, `${identity.reference}.${field}`);
    assert.equal(identity.mediaConsentUsed, false);
  }
  assert.equal(receipt.identities[0].chatgunUatIdentityDeletionAuthorized, false);
  assert.equal(typeof receipt.identities[1].chatgunUatIdentityDeletionAuthorized, 'boolean');
  return receipt;
}

export function finalUatSocialVars(receipt) {
  validateFinalUatSocialApproval(receipt);
  const enabledProviders = [...new Set(receipt.identities.map(identity => identity.provider))].sort().join(',');
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
    operatorCount: 1,
    identities: receipt.identities.map(identity => ({ reference: identity.reference, provider: identity.provider, chatgunUatIdentityDeletionAuthorized: identity.reference === 'B' ? identity.chatgunUatIdentityDeletionAuthorized : false })),
    humanEvidenceClassification: 'single-operator-dual-account-functional-e2e',
    enabledProviders: vars.OAUTH_ENABLED_PROVIDERS.split(','),
    mediaEnabled: false,
    publicRegistrationEnabled: false,
    youthAdmissionEnabled: false,
    productionChangesAuthorized: false,
  };
}

export function hashAndRemovePrivateIdentityReferences(receipt) {
  const sanitized = structuredClone(receipt);
  for (const identity of sanitized.identities || []) {
    assert.equal(identity.providerAccountReferenceSha256, null, `${identity.reference}.providerAccountReferenceSha256 must be empty before finalization`);
    assert.equal(typeof identity.providerAccountReferencePrivate, 'string');
    const privateReference = identity.providerAccountReferencePrivate.trim();
    assert.ok(privateReference.length >= 3, `${identity.reference}.providerAccountReferencePrivate is required`);
    identity.providerAccountReferenceSha256 = createHash('sha256').update(`${identity.provider}\0${privateReference}`).digest('hex');
    identity.providerAccountReferencePrivate = '';
  }
  validateFinalUatSocialApproval(sanitized);
  return sanitized;
}
