# Phase 8 curated release hygiene

The release is rebuilt from verified `main` (`1873fd3c9aae5a0efc26fef47b98753d8fa31308`) rather than cleaning PR #27 in place. Removing files from PR #27 would not remove its historical blobs and would leave the integration review attached to a very large binary history.

The curated tree retains application and Pages Functions source, the Production migration lane through schema 21, isolated migration 22 outside that lane, policy documents, automated tests, CI workflows and small evidence manifests. Generated screenshots, recordings, browser traces, caches, private handoffs, credential downloads and duplicate report bundles are not copied. Historical evidence remains reachable through the original PR refs and protected local storage; this cleanup does not claim to erase Git objects.

Production OAuth now fails closed unless `OAUTH_LOGIN_ENABLED` is exactly `true` and `OAUTH_ENABLED_PROVIDERS` is a non-empty list containing only supported providers. Non-Production isolated environments retain their prior explicit behavior.

The checked-in Production profile documents the verified Admin state, but deployments must use the configuration-free staged artifact and preservation comparison. It must never be treated as authorization to mutate the live Pages configuration.
