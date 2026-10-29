// Validate the owner handoff itself without opening or mutating a genuine session.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve('docs/development-completion');
const privateRoot='/Users/nattano/.codex/private-backups/chatgun';
const directories=readdirSync(privateRoot).filter(name=>name.startsWith('age-admin-isolated-schema-')).map(name=>resolve(privateRoot,name)).filter(path=>existsSync(resolve(path,'verification.json'))).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs);
assert.ok(directories.length,'Actual scoped migration backup required');
const verification=JSON.parse(readFileSync(resolve(directories[0],'verification.json')));
assert.equal(verification.database,'275d9820-6aec-494a-8bb5-b7ed9b8b74cc');assert.ok(verification.migrations.includes('0021_eligibility_review_requests.sql'));
const backup=resolve(directories[0],'before.sql'),sql=readFileSync(backup,'utf8');
assert.equal(statSync(backup).mode & 0o777, 0o600);
const restored = new DatabaseSync(':memory:');
let backupCheck;
try {
  restored.exec('PRAGMA foreign_keys=OFF');restored.exec(sql);
  assert.equal(restored.prepare('SELECT COUNT(*) n FROM d1_migrations').get().n, 20);
  assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length, 0);
  backupCheck = { scope: 'isolated-before-0021, not Production', sha256: createHash('sha256').update(sql).digest('hex'), bytes: Buffer.byteLength(sql), permissions: '0600', restoredMigrations: 20, foreignKeyViolations: 0, restore: 'PASS: in-memory SQLite' };
} finally { restored.close(); }
const pages = ['report.html'];
const checks = [];
mkdirSync(resolve(root, 'report-screens'), { recursive: true });
const browser = await chromium.launch();
try {
  for (const name of pages) {
    const file = resolve(root, name);
    const html = readFileSync(file, 'utf8');
    for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|#)/.test(link)) continue;
      const target = resolve(dirname(file), link.split('#')[0]);
      assert.ok(target.startsWith(root + '/'), 'Handoff links must stay in the public report package');
      assert.ok(existsSync(target), 'Missing handoff link: ' + link);
    }
    for (const width of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(file).href);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' overflow at ' + width);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: resolve(root, 'report-screens', name.replace('.html', '') + '-' + width + '.png') });
      checks.push({ page: name, width, overflow: false, scriptErrors: 0 });
      await page.close();
    }
  }
} finally { await browser.close(); }
writeFileSync(resolve(root, 'handoff-validation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, passed: checks.length, backupCheck }, null, 2) + '\n');
console.log('Current owner report links, three responsive layouts, protected backup restore and script-error checks PASS.');
