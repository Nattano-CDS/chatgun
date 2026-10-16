import assert from "node:assert/strict";
import test from "node:test";
import { ageOnDate, bangkokDate, selfDeclaredAdult } from "../functions/_lib/age.js";

test("age calculation uses the Bangkok calendar date and exact birthday boundary", () => {
  assert.equal(ageOnDate("2008-10-16", "2026-10-16"), 18);
  assert.equal(ageOnDate("2008-10-17", "2026-10-16"), 17);
  assert.equal(ageOnDate("2008-02-29", "2026-02-28"), 17);
  assert.equal(ageOnDate("2008-02-29", "2026-03-01"), 18);
  assert.equal(bangkokDate(Date.parse("2026-10-15T18:30:00Z")), "2026-10-16");
});

test("age declaration rejects invalid, future, and implausibly old dates", () => {
  for (const value of ["", "2008-02-30", "08/10/2000", "2027-01-01", "1800-01-01"]) {
    assert.equal(selfDeclaredAdult(value, Date.parse("2026-10-16T00:00:00Z")).valid, false, value);
  }
  assert.deepEqual(selfDeclaredAdult("2000-01-01", Date.parse("2026-10-16T00:00:00Z")), { valid: true, adult: true, age: 26 });
});
