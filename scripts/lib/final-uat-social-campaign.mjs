import assert from 'node:assert/strict';

export const FINAL_UAT_ACCOUNT = '23017b53386fb67fc62a52cdd017454c';
export const FINAL_UAT_PROJECT = 'chatgun-final-uat';
export const FINAL_UAT_ORIGIN = 'https://uat.chatgun-final-uat.pages.dev';
export const FINAL_UAT_DATABASE = 'e3cb426c-b88a-4b93-90fd-39df524f68ae';
export const FINAL_UAT_BUCKET = 'chatgun-final-uat-media';
export const FINAL_UAT_APPLICATION_SHA = '4a7dee32c52bc474ee3cc50d13e293e66e771c1a';
export const OWNER_AUTHORIZATION_COMMENT = 6470727761;

export const PROPOSED_POLICY = Object.freeze({
  versions: {
    adultNotice: 'adult-social-uat-2026-10-28-rc1',
    terms: 'terms-social-uat-2026-10-28-rc1',
    privacy: 'privacy-social-uat-2026-10-28-rc1',
    deletion: 'deletion-social-uat-2026-10-28-rc1',
  },
  files: {
    'beta-notice.html': 'e01da689a1d91bbcc994f47eb734a191852fb2f162db0d19025bdab4fb4bb394',
    'terms.html': '7b381aaed9ab52f0033a7aec0d2ec4c3951317ad52ed23acc981ff0bc7717dc3',
    'privacy.html': 'be5d8578da6a3e3fd0d6180a37fdde7667565d719b35ec880ffe6105d703f48b',
    'data-deletion.html': 'b55216f2b9853d70476484042644896431e9abdbe9daecd9d641bd7e2105d4e4',
  },
});

const providers = new Set(['google', 'facebook', 'line']);
const referencePattern = /^[a-f0-9]{64}$/u;

function exactBangkokWindow(window) {
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
  assert.equal(receipt.scope, 'final-uat-social-location-chat-privacy');
  assert.equal(receipt.ownerAuthorizationComment, OWNER_AUTHORIZATION_COMMENT);
  assert.equal(receipt.policyApproved, true);
  assert.deepEqual(receipt.policyVersions, PROPOSED_POLICY.versions);
  assert.deepEqual(receipt.policyFiles, PROPOSED_POLICY.files);
  assert.equal(receipt.operations?.moderationCoverage, '19:00-22:00 Asia/Bangkok daily');
  assert.equal(receipt.operations?.no24x7OrBackupModeratorClaim, true);
  assert.equal(receipt.operations?.mediaEnabled, false);
  assert.equal(receipt.operations?.publicRegistrationEnabled, false);
  assert.equal(receipt.operations?.youthAdmissionEnabled, false);
  assert.equal(receipt.operations?.productionChangesAuthorized, false);
  assert.equal(receipt.operations?.retentionDecision, 'campaign-plus-7-days-logical-cleanup-with-recovery-caveat');
  assert.equal(receipt.operations?.recoveryCaveatAcknowledged, true);
  assert.equal(receipt.operations?.ownerAccountDeletionAuthorized, false);
  exactBangkokWindow(receipt.window);
  assert.equal(receipt.participants?.length, 2);
  assert.deepEqual(receipt.participants.map(p => p.reference), ['A', 'B']);
  assert.equal(new Set(receipt.participants.map(p => p.providerAccountReferenceSha256)).size, 2);
  for (const participant of receipt.participants) {
    assert.ok(providers.has(participant.provider));
    assert.match(participant.providerAccountReferenceSha256, referencePattern);
    for (const field of ['genuineDistinctAdultConfirmed', 'age20PlusConfirmed', 'individualConsentConfirmed', 'providerTesterEligible', 'socialScopeConsent', 'locationScopeConsent', 'chatScopeConsent', 'privacyScopeConsent', 'disposableTestDataConsent']) assert.equal(participant[field], true, `${participant.reference}.${field}`);
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
