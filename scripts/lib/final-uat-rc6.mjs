import assert from 'node:assert/strict';
import { PROPOSED_POLICY as RC5_POLICY, finalUatSocialVars, validateFinalUatSocialApproval } from './final-uat-social-campaign.mjs';

export const RC6_POLICY = Object.freeze({
  versions: {
    adultNotice: 'adult-social-friends-single-operator-dual-account-uat-2026-10-30-rc6a',
    terms: 'terms-social-friends-single-operator-dual-account-uat-2026-10-30-rc6a',
    privacy: 'privacy-social-friends-single-operator-dual-account-uat-2026-10-30-rc6a',
    deletion: 'deletion-social-friends-single-operator-dual-account-uat-2026-10-30-rc6a',
  },
  files: {
    'policies/final-uat/single-operator-rc6a/beta-notice.html': '19168e805f6b6edc2d02b31b2cc6bd430334f00464d58383e36ce7705a5aa414',
    'policies/final-uat/single-operator-rc6a/terms.html': '3497b3c7fb41bbbeb53cb4c48fff34c5f6b370fa17bdacad8a9029940d5464b1',
    'policies/final-uat/single-operator-rc6a/privacy.html': '221d03f59511625dddaf4ac044cf20974ee5e726819b9122eda3b90eb9e79e54',
    'policies/final-uat/single-operator-rc6a/data-deletion.html': '6d32072e58a183c16f7e6594246450f334c1f531331776dd021faa6a53844100',
  },
});

function asRc5(receipt) {
  const copy = structuredClone(receipt);
  copy.policyVersions = RC5_POLICY.versions;
  copy.policyFiles = RC5_POLICY.files;
  delete copy.rc6Approval;
  delete copy.operator.mutualFriendsConsent;
  return copy;
}

export function validateFinalUatRc6Approval(receipt) {
  validateFinalUatSocialApproval(asRc5(receipt));
  assert.deepEqual(receipt.policyVersions, RC6_POLICY.versions);
  assert.deepEqual(receipt.policyFiles, RC6_POLICY.files);
  assert.equal(receipt.operator?.mutualFriendsConsent, true);
  assert.equal(receipt.rc6Approval?.scope, 'isolated-private-uat-only');
  assert.equal(receipt.rc6Approval?.bothOwnerControlledIdentities, true);
  assert.match(receipt.rc6Approval?.approvedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(receipt.rc6Approval?.approvalTextSha256, /^[a-f0-9]{64}$/u);
  return receipt;
}

export function finalUatRc6Vars(receipt) {
  validateFinalUatRc6Approval(receipt);
  return {
    ...finalUatSocialVars(asRc5(receipt)),
    ADULT_NOTICE_VERSION: RC6_POLICY.versions.adultNotice,
    TERMS_VERSION: RC6_POLICY.versions.terms,
    PRIVACY_VERSION: RC6_POLICY.versions.privacy,
    FRIEND_REQUESTS_ENABLED: 'true',
  };
}
