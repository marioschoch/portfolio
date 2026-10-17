/**
 * Post-build step: computes SHA-256 hashes of every inline <script> in dist/**.html and
 * writes them into dist/.htaccess (placeholder __CSP_SCRIPT_HASHES__).
 *
 * Why: Astro inlines small scripts (theme switch, menus, palette …). A strict CSP without
 * 'unsafe-inline' must list each one by hash. Data blocks (application/json, application/ld+json)
 * are not executed, so they need no hash.
 *
 * Runs automatically as part of `npm run build`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const HTACCESS = join(DIST, '.htaccess');
const PLACEHOLDER = '__CSP_SCRIPT_HASHES__';
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith('.html')) yield path;
  }
}

const hashes = new Set();
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, 'utf8');
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(attrs)) continue; // external file, covered by 'self'
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/.exec(attrs)?.[1]?.toLowerCase();
    if (type && DATA_TYPES.has(type)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
}

const htaccess = readFileSync(HTACCESS, 'utf8');
if (!htaccess.includes(PLACEHOLDER)) {
  throw new Error(`${HTACCESS} has no ${PLACEHOLDER} placeholder — was public/.htaccess copied?`);
}
writeFileSync(HTACCESS, htaccess.replace(PLACEHOLDER, [...hashes].sort().join(' ')));
console.log(`[csp] ${hashes.size} inline script hashes written to ${HTACCESS}`);
