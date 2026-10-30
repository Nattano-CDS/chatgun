import assert from "node:assert/strict";
import test from "node:test";
import { ageOnDate, bangkokDate, selfDeclaredAdult, selfDeclaredAgeBand } from "../functions/_lib/age.js";

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

test('13+ preparation classifies exact 13/18/20 birthday boundaries without returning DOB or admitting minors', () => {
  const timestamp = Date.parse('2026-10-19T17:01:00Z'); // 20 October, Bangkok
  for (const [dob, band] of [['2013-10-21', 'under_13'], ['2013-10-20', '13_17'],
    ['2008-10-21', '13_17'], ['2008-10-20', '18_19'], ['2006-10-21', '18_19'], ['2006-10-20', '20_plus']]) {
    assert.deepEqual(selfDeclaredAgeBand(dob, timestamp), { valid: true, band, independentlyVerified: false });
  }
  assert.deepEqual(selfDeclaredAgeBand('2013-02-30', timestamp), { valid: false, band: null, independentlyVerified: false });
  assert.equal(selfDeclaredAdult('2013-10-20', timestamp).adult, false, 'Existing adult admission gate is not weakened');
});
