# Repository governance and integration

Read-only inspection found no `main` protection/ruleset and Dependabot alerts/security updates disabled. Secret scanning and push protection were enabled; open CodeQL and secret-scanning alerts were zero at inspection. Existing weekly Dependabot configuration is present but does not enable repository alerts.

The release branch was 259 commits ahead and 0 behind `main`, with a very large diff, while PR #25 targets the stacked JWKS branch rather than `main`. This must not be collapsed into an unaudited direct merge. Review the complete PR dependency chain, define an integration branch or ordered merges, re-run required checks at the final merge head, then apply `proposed-main-ruleset.json` and require the pinned Dependency Review workflow. Repository-administration changes remain owner actions.
