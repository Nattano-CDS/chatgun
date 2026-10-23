function enabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function acceptanceFlowEnabled(env) {
  return enabled(env.ACCEPTANCE_FLOW_ENABLED);
}

export function requiredAcceptanceVersions(env) {
  if (!acceptanceFlowEnabled(env)) return null;
  const versions = {
    adultNotice: String(env.ADULT_NOTICE_VERSION || "").trim(),
    terms: String(env.TERMS_VERSION || "").trim(),
    privacy: String(env.PRIVACY_VERSION || "").trim(),
  };
  if (!versions.adultNotice || !versions.terms || !versions.privacy) {
    throw new Error("missing_acceptance_versions");
  }
  // Enabling a flag must never turn a placeholder policy into accepted evidence.
  if (Object.values(versions).some(version => /(?:pending|draft|unapproved|owner[-_ ]approval|tbd)/iu.test(version))) {
    throw new Error("unapproved_acceptance_versions");
  }
  return versions;
}

export async function currentAcceptance(db, userId, env) {
  const versions = requiredAcceptanceVersions(env);
  if (!versions) return { required: false, accepted: true, versions: null };
  const row = await db.prepare(`
    SELECT accepted_at, adult_declared_at
    FROM account_acceptances
    WHERE user_id = ? AND adult_notice_version = ? AND terms_version = ? AND privacy_version = ?
  `).bind(userId, versions.adultNotice, versions.terms, versions.privacy).first();
  return { required: true, accepted: Boolean(row), versions, acceptedAt: row?.accepted_at || null };
}

export async function accountJourney(db, userId, env) {
  const user = await db.prepare(
    "SELECT account_state FROM users WHERE id = ? AND status = 'active'",
  ).bind(userId).first();
  if (!user) throw new Error("account_disabled");
  const ageHold = await db.prepare("SELECT 1 held FROM member_age_safety_holds WHERE user_id=? AND (state='held' OR age_band<>'20_plus')").bind(userId).first();
  if (ageHold) return { nextPath: '/account.html?access=age-review', acceptanceRequired: false, accountState: user.account_state, ageSafetyReviewRequired: true };
  if (!acceptanceFlowEnabled(env)) return { nextPath: "/account.html", acceptanceRequired: false };
  const acceptance = await currentAcceptance(db, userId, env);
  if (!acceptance.accepted || user.account_state === "pending_acceptance") {
    return { nextPath: "/acceptance", acceptanceRequired: true, accountState: user.account_state };
  }
  const profile = await db.prepare("SELECT 1 present FROM member_profiles WHERE user_id = ?").bind(userId).first();
  if (!profile || user.account_state === "pending_onboarding") {
    return { nextPath: "/app/?onboarding=1", acceptanceRequired: false, accountState: "pending_onboarding" };
  }
  return { nextPath: "/app/", acceptanceRequired: false, accountState: user.account_state };
}
