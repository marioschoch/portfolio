/**
 * Deploys dist/ to the web root (httpdocs) over SFTP — used by .github/workflows/deploy.yml.
 *
 * How it decides what to do:
 *   - The server keeps a manifest (.deploy-manifest.json: path → SHA-256) of the files that
 *     previous deploys uploaded.
 *   - Only files whose content changed (or that are new) are uploaded: assets first, then
 *     HTML/.htaccess, so pages never reference files that aren't there yet.
 *   - Only files that are listed in the previous manifest AND no longer exist in dist/ are
 *     deleted. Files this script never uploaded (.well-known/, Plesk files, manual uploads)
 *     are never touched.
 *   - The manifest is written last; an interrupted deploy is simply repeated next time.
 *
 * Configuration (environment variables — in CI they come from GitHub Secrets):
 *   SFTP_HOST, SFTP_PORT (default 22), SFTP_USER
 *   SFTP_PRIVATE_KEY (+ optional SFTP_PASSPHRASE)  or  SFTP_PASSWORD
 *   SFTP_KNOWN_HOSTS   output of `ssh-keyscan -p <port> <host>`; the server key must match
 *   SFTP_REMOTE_PATH   e.g. /httpdocs — must end in "httpdocs" (safety check)
 *
 * Flags:
 *   --dry-run        show what would happen, change nothing
 *   --full           upload every file, ignoring the remote manifest
 *   --local <dir>    deploy into a local folder instead of SFTP (for testing)
 */
import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

const DIST = 'dist';
const MANIFEST = '.deploy-manifest.json';
/** Paths that are never uploaded to or deleted from the server. */
const PROTECTED = [/^\.well-known(\/|$)/, /^\.deploy-manifest/];
const UPLOAD_CONCURRENCY = 4;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const full = args.includes('--full');
const localIdx = args.indexOf('--local');
const localTarget = localIdx >= 0 ? args[localIdx + 1] : undefined;

const log = (...m) => console.log('[deploy]', ...m);
const fail = (msg) => {
  console.error(`[deploy] ERROR: ${msg}`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Local build manifest
// ---------------------------------------------------------------------------
async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

async function buildManifest() {
  if (!existsSync(join(DIST, 'index.html')))
    fail('dist/index.html not found — run `npm run build` first.');
  const manifest = {};
  for (const file of await walk(DIST)) {
    const rel = relative(DIST, file).split(sep).join('/');
    if (PROTECTED.some((re) => re.test(rel))) continue;
    manifest[rel] = createHash('sha256')
      .update(await fs.readFile(file))
      .digest('hex');
  }
  return manifest;
}

// ---------------------------------------------------------------------------
// Transports: SFTP (production) and local folder (testing). Same small interface.
// ---------------------------------------------------------------------------
async function sftpTransport(root) {
  const { default: SftpClient } = await import('ssh2-sftp-client');
  const env = process.env;
  for (const key of ['SFTP_HOST', 'SFTP_USER', 'SFTP_KNOWN_HOSTS']) {
    if (!env[key]) fail(`Missing ${key}.`);
  }
  if (!env.SFTP_PRIVATE_KEY && !env.SFTP_PASSWORD) fail('Set SFTP_PRIVATE_KEY or SFTP_PASSWORD.');

  // Host key pinning: only connect if the server presents a key listed in SFTP_KNOWN_HOSTS.
  const knownKeys = env.SFTP_KNOWN_HOSTS.split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3 && !parts[0].startsWith('#'))
    .map(([, type, key]) => ({ type, key: Buffer.from(key, 'base64') }));
  if (!knownKeys.length) fail('SFTP_KNOWN_HOSTS contains no valid key line.');

  const client = new SftpClient();
  await client.connect({
    host: env.SFTP_HOST,
    port: Number(env.SFTP_PORT || 22),
    username: env.SFTP_USER,
    ...(env.SFTP_PRIVATE_KEY
      ? { privateKey: env.SFTP_PRIVATE_KEY, passphrase: env.SFTP_PASSPHRASE || undefined }
      : { password: env.SFTP_PASSWORD }),
    algorithms: { serverHostKey: [...new Set(knownKeys.map((k) => k.type))] },
    hostVerifier: (key) => knownKeys.some((k) => k.key.equals(key)),
    readyTimeout: 30000,
  });
  const p = (rel) => posix.join(root, rel);
  return {
    read: async (rel) =>
      (await client.exists(p(rel))) ? (await client.get(p(rel))).toString('utf8') : null,
    exists: async (rel) => Boolean(await client.exists(p(rel))),
    mkdir: (rel) => client.mkdir(p(rel), true),
    put: (local, rel) => client.put(local, p(rel)),
    write: (rel, text) => client.put(Buffer.from(text), p(rel)),
    remove: (rel) => client.delete(p(rel), true),
    rmdirIfEmpty: async (rel) => {
      const list = await client.list(p(rel)).catch(() => null);
      if (list && list.length === 0) await client.rmdir(p(rel));
    },
    close: () => client.end(),
  };
}

function localTransport(root) {
  const p = (rel) => join(root, ...rel.split('/'));
  return {
    read: async (rel) => (existsSync(p(rel)) ? fs.readFile(p(rel), 'utf8') : null),
    exists: async (rel) => existsSync(p(rel)),
    mkdir: (rel) => fs.mkdir(p(rel), { recursive: true }),
    put: (local, rel) => fs.copyFile(local, p(rel)),
    write: (rel, text) => fs.writeFile(p(rel), text),
    remove: (rel) => fs.rm(p(rel), { force: true }),
    rmdirIfEmpty: async (rel) => {
      if (existsSync(p(rel)) && (await fs.readdir(p(rel))).length === 0) await fs.rmdir(p(rel));
    },
    close: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function pool(items, limit, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

const isPage = (rel) => /\.(html|xml|txt)$/.test(rel) || rel.endsWith('.htaccess');

async function main() {
  const remoteRoot = localTarget ?? process.env.SFTP_REMOTE_PATH ?? '';
  if (!localTarget) {
    // Safety: never deploy into anything but a Plesk web root.
    const clean = remoteRoot.replace(/\/+$/, '');
    if (!clean || clean === '/' || posix.basename(clean) !== 'httpdocs') {
      fail(`SFTP_REMOTE_PATH must point to the httpdocs folder (got "${remoteRoot}").`);
    }
  }

  const local = await buildManifest();
  log(
    `${Object.keys(local).length} files in dist/ → ${localTarget ? `local:${localTarget}` : remoteRoot}`,
  );

  const remote = localTarget ? localTransport(localTarget) : await sftpTransport(remoteRoot);
  try {
    const previousRaw = await remote.read(MANIFEST);
    let previous = {};
    if (previousRaw) {
      try {
        previous = JSON.parse(previousRaw).files ?? {};
      } catch {
        log('Remote manifest unreadable — treating this as a first deploy.');
      }
    } else {
      log('No remote manifest — first deploy, uploading everything.');
    }

    const changed = Object.keys(local).filter((rel) => full || previous[rel] !== local[rel]);
    const stale = Object.keys(previous).filter(
      (rel) => !(rel in local) && !PROTECTED.some((re) => re.test(rel)),
    );
    const assets = changed.filter((rel) => !isPage(rel));
    const pages = changed.filter(isPage);

    log(
      `upload: ${changed.length} (${assets.length} assets, ${pages.length} pages/config) · delete: ${stale.length} · unchanged: ${Object.keys(local).length - changed.length}`,
    );
    if (dryRun) {
      for (const rel of [...assets, ...pages]) log('  + ', rel);
      for (const rel of stale) log('  - ', rel);
      log('Dry run — nothing changed.');
      return;
    }

    // Create directories once, then upload: assets first, pages + .htaccess second.
    const dirs = [
      ...new Set(changed.map((rel) => posix.dirname(rel)).filter((d) => d !== '.')),
    ].sort();
    for (const dir of dirs) await remote.mkdir(dir);
    let done = 0;
    for (const batch of [assets, pages]) {
      await pool(batch, UPLOAD_CONCURRENCY, async (rel) => {
        await remote.put(join(DIST, ...rel.split('/')), rel);
        if (++done % 25 === 0) log(`  uploaded ${done}/${changed.length}`);
      });
    }

    // Remove files from earlier deploys that are gone now, then their empty folders (deepest first).
    for (const rel of stale) await remote.remove(rel);
    const staleDirs = [
      ...new Set(
        stale.flatMap((rel) => {
          const parts = rel.split('/').slice(0, -1);
          return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
        }),
      ),
    ].sort((a, b) => b.length - a.length);
    for (const dir of staleDirs) await remote.rmdirIfEmpty(dir);

    await remote.write(
      MANIFEST,
      JSON.stringify(
        {
          deployedAt: new Date().toISOString(),
          commit: process.env.GITHUB_SHA ?? null,
          files: local,
        },
        null,
        0,
      ),
    );
    log(`Done: ${changed.length} uploaded, ${stale.length} deleted.`);
  } finally {
    await remote.close();
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
