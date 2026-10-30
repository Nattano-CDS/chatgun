# Corrected rc6a private-UAT owner review

Status: **PROPOSED — NOT APPROVED — NOT ACTIVE**.

The first rc6 activation stopped before deployment or configuration change because the Adult Notice declared `adult-social-social-friends...rc6` while its manifest declared `adult-social-friends...rc6`. UAT remains rc5 with Friends disabled.

rc6a corrects that identifier and changes the conditional header so an approved document does not display “not approved.” The substantive Friends scope is unchanged: request, accept, reject, cancel, remove, friend-only messaging, block removes friendship, and unblock does not restore it. Because bytes and all four hashes changed, a new exact approval is mandatory.
