import assert from 'node:assert/strict';
import { PROPOSED_POLICY as RC5_POLICY, finalUatSocialVars, validateFinalUatSocialApproval } from './final-uat-social-campaign.mjs';

export const RC6_POLICY = Object.freeze({
  versions: {
    adultNotice: 'adult-social-friends-single-operator-dual-account-uat-2026-10-30-rc6',
    terms: 'terms-social-friends-single-operator-dual-account-uat-2026-10-30-rc6',
    privacy: 'privacy-social-friends-single-operator-dual-account-uat-2026-10-30-rc6',
    deletion: 'deletion-social-friends-single-operator-dual-account-uat-2026-10-30-rc6',
  },
  files: {
    'policies/final-uat/single-operator-rc6/beta-notice.html': '51a3d29a2ec4f2d2c37dfe1083d5644c50688c2f98c1efb07edc19fde69848c6',
    'policies/final-uat/single-operator-rc6/terms.html': 'bc22928c1d7b2e94c643d58c50f4fe81d19ce2d5dd7825adbf6839d9e73872ae',
    'policies/final-uat/single-operator-rc6/privacy.html': '0aff863c3ce838fd568a56f8ab130c2e37b8662575ea0117b211e53756149f86',
    'policies/final-uat/single-operator-rc6/data-deletion.html': 'fa32d86d0649e3f2ec3cdd7789aab205654e62648c9a51f35c1623a2ed6ac0a5',
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
