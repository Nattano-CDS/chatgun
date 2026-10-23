import assert from 'node:assert/strict';
// D1 meta.changes can include FK cascades. Never label it a number of accounts.
export function accountCleanupCounts({manifestActors,usersBefore,usersAfter,d1WriteChanges}) {
 for(const n of[manifestActors,usersBefore,usersAfter,d1WriteChanges])assert.ok(Number.isSafeInteger(n)&&n>=0);
 assert.ok(usersAfter<=usersBefore&&usersBefore<=manifestActors);
 return {exactManifestActors:manifestActors,alreadyDeletedByAuthorizedBrowserTests:manifestActors-usersBefore,remainingSyntheticAccountsDeleted:usersBefore-usersAfter,d1CascadeInclusiveWriteChanges:d1WriteChanges,remainingUsers:usersAfter};
}
