import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseJsonc(path) {
  const source = readFileSync(path, 'utf8')
    .replace(/^\s*\/\/.*$/gmu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/,\s*([}\]])/gu, '$1');
  return JSON.parse(source);
}

export function verifyProductionPreservation(candidateVars, fingerprint) {
  const normalized = key => Object.hasOwn(candidateVars, key) ? candidateVars[key] : null;
  const preserved = Object.entries(fingerprint.mustPreserve).map(([key, expected]) => ({
    key, expected, actual: normalized(key), pass: normalized(key) === expected,
  }));
  const restricted = Object.entries(fingerprint.mustRemainDisabled).map(([key, expected]) => ({
    key, expected, actual: normalized(key), pass: normalized(key) === expected,
  }));
  const pilotRegressions = preserved.filter(item => !item.pass);
  const restrictedActivations = restricted.filter(item => !item.pass);
  return {
    productionSha: fingerprint.productionSha,
    candidateSource: 'supplied by caller',
    pilotRegressions,
    restrictedActivations,
    passedChecks: [...preserved, ...restricted].filter(item => item.pass).length,
    totalChecks: preserved.length + restricted.length,
    result: pilotRegressions.length || restrictedActivations.length ? 'BLOCKED' : 'PASS',
  };
}

function valueAfter(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fingerprintPath = resolve(root, valueAfter('--fingerprint') || 'docs/production-readiness/phase6/production-owner-pilot-fingerprint.json');
  const varsPath = valueAfter('--vars-json');
  const configPath = resolve(root, valueAfter('--config') || 'wrangler.jsonc');
  const fingerprint = JSON.parse(readFileSync(fingerprintPath, 'utf8'));
  const source = varsPath ? parseJsonc(resolve(root, varsPath)) : parseJsonc(configPath);
  const vars = varsPath ? (source.vars || source) : source.env?.production?.vars;
  if (!vars || typeof vars !== 'object') throw new Error('Production candidate variables were not found');
  const result = verifyProductionPreservation(vars, fingerprint);
  result.candidateSource = varsPath || 'wrangler.jsonc env.production.vars';
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes('--enforce') && result.result !== 'PASS') process.exitCode = 1;
}
