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
    'policies/final-uat/single-operator-rc6a/terms.html': '389ea93cdabce0fd113552b183f7367eddd0bc16e462390b7f6969c8739e36fd',
    'policies/final-uat/single-operator-rc6a/privacy.html': '25147379e2469c6d36204cd6ef7e3761c0fa4eee3e1748d9d5601acafa6bd194',
    'policies/final-uat/single-operator-rc6a/data-deletion.html': 'c45a4c5442fea833460442cc452dc0ca310907a8b1f2bb2abc7854ac6dc6322d',
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
