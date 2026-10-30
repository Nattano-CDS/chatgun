const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

function parts(value) {
  const match = ISO_DATE.exec(String(value || ""));
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function bangkokDate(timestampMs = Date.now()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function ageOnDate(dateOfBirth, currentDate) {
  const birth = parts(dateOfBirth);
  const current = parts(currentDate);
  if (!birth || !current) return null;
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function selfDeclaredAdult(dateOfBirth, timestampMs = Date.now()) {
  const age = ageOnDate(dateOfBirth, bangkokDate(timestampMs));
  return { valid: age !== null, adult: age !== null && age >= 18, age };
}

// Preparation for the owner-approved minimum of 13. This classifier does NOT
// admit minors or grant social permissions; existing adult gates stay intact
// until the reviewed youth/capacity workflow and endpoint protections exist.
// The input date is transient; callers must never log or persist it.
export function selfDeclaredAgeBand(dateOfBirth, timestampMs = Date.now()) {
  const age = ageOnDate(dateOfBirth, bangkokDate(timestampMs));
  if (age === null) return { valid: false, band: null, independentlyVerified: false };
  const band = age < 13 ? 'under_13' : age < 18 ? '13_17' : age < 20 ? '18_19' : '20_plus';
  return { valid: true, band, independentlyVerified: false };
}
