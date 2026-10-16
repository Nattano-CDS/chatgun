// Publish only the explicit project-owned fictional fixture. Never read D1, R2 or session bundles.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
const source = JSON.parse(readFileSync("scripts/fixtures/social-owner-review-v1.json", "utf8"));
const directory = resolve("assets/demo");
mkdirSync(directory, { recursive: true });
const fixture = { batchId: "chatgun-browser-demo-v1", fictional: true, adults: true, license: source.license,
  profiles: source.profiles.map(({ slug, name, gender, bio, interests }) => ({ slug, name, gender, bio, interests })),
  conversations: source.conversations.map(({ with: target, messages }) => ({ with: target, messages })),
};
writeFileSync(resolve(directory, "network.json"), JSON.stringify(fixture, null, 2) + "\n");
for (const { slug } of fixture.profiles) copyFileSync(`scripts/fixtures/portraits/${slug}.png`, resolve(directory, `${slug}.png`));
console.log(`Built ${fixture.profiles.length} fictional portraits and ${fixture.conversations.reduce((n,c) => n+c.messages.length,0)} messages; no database access.`);
