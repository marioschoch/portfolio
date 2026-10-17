/**
 * Deploys dist/ to the web root (Plesk "Dokumentstamm") over SFTP or FTPS — used by .github/workflows/deploy.yml.
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
 *   DEPLOY_PROTOCOL     "ftps" or "sftp" (default: sftp)
 *   DEPLOY_HOST         server name; for FTPS it must match the TLS certificate
 *                       (e.g. venus.kreativmedia.ch, not marioschoch.ch)
 *   DEPLOY_PORT         default 22 (sftp) / 21 (ftps); kreativmedia's SSH port is 2121
 *   DEPLOY_USER
 *   DEPLOY_PASSWORD     FTPS: required. SFTP: or use DEPLOY_PRIVATE_KEY (+ DEPLOY_PASSPHRASE)
 *   DEPLOY_KNOWN_HOSTS  SFTP only: output of `ssh-keyscan -p <port> <host>`; the server key must match
 *   DEPLOY_REMOTE_PATH  the web root, e.g. /marioschoch.ch — its folder name must be in WEB_ROOT_NAMES
 *                       (safety check, so a typo can never sync into the wrong folder)
 *
 * FTPS uses explicit TLS (AUTH TLS) and always verifies the server certificate; plain,
 * unencrypted FTP is not supported.
 *
 * Flags:
 *   --dry-run        show what would happen, change nothing
 *   --full           upload every file, ignoring the remote manifest
 *   --local <dir>    deploy into a local folder instead of a server (for testing)
 */
import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { Readable, Writable } from 'node:stream';

const DIST = 'dist';
const MANIFEST = '.deploy-manifest.json';
/** Paths that are never uploaded to or deleted from the server. */
const PROTECTED = [/^\.well-known(\/|$)/, /^\.deploy-manifest/];
/**
 * Folder names accepted as deploy target. On kreativmedia the Plesk document root ("Dokumentstamm")
 * is named after the domain; `httpdocs` is the Plesk default elsewhere.
 */
const WEB_ROOT_NAMES = ['marioschoch.ch', 'httpdocs'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const full = args.includes('--full');
const localIdx = args.indexOf('--local');
const localTarget = localIdx >= 0 ? args[localIdx + 1] : undefined;

const env = process.env;
const protocol = (env.DEPLOY_PROTOCOL || 'sftp').toLowerCase();

const log = (...m) => console.log('[deploy]', ...m);
const fail = (msg) => {
  console.error(`[deploy] ERROR: ${msg}`);
  process.exit(1);
};
const requireEnv = (...keys) => {
  for (const key of keys) if (!env[key]) fail(`Missing ${key}.`);
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
// Transports: SFTP, FTPS and a local folder (testing). Same small interface.
// ---------------------------------------------------------------------------
async function sftpTransport(root) {
  const { default: SftpClient } = await import('ssh2-sftp-client');
  requireEnv('DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_KNOWN_HOSTS');
  if (!env.DEPLOY_PRIVATE_KEY && !env.DEPLOY_PASSWORD) {
    fail('Set DEPLOY_PRIVATE_KEY or DEPLOY_PASSWORD.');
  }

  // Host key pinning: only connect if the server presents a key listed in DEPLOY_KNOWN_HOSTS.
  const knownKeys = env.DEPLOY_KNOWN_HOSTS.split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3 && !parts[0].startsWith('#'))
    .map(([, type, key]) => ({ type, key: Buffer.from(key, 'base64') }));
  if (!knownKeys.length) fail('DEPLOY_KNOWN_HOSTS contains no valid key line.');

  const client = new SftpClient();
  await client.connect({
    host: env.DEPLOY_HOST,
    port: Number(env.DEPLOY_PORT || 22),
    username: env.DEPLOY_USER,
    ...(env.DEPLOY_PRIVATE_KEY
      ? { privateKey: env.DEPLOY_PRIVATE_KEY, passphrase: env.DEPLOY_PASSPHRASE || undefined }
      : { password: env.DEPLOY_PASSWORD }),
    algorithms: { serverHostKey: [...new Set(knownKeys.map((k) => k.type))] },
    hostVerifier: (key) => knownKeys.some((k) => k.key.equals(key)),
    readyTimeout: 30000,
  });
  const p = (rel) => posix.join(root, rel);
  return {
    concurrency: 4,
    read: async (rel) =>
      (await client.exists(p(rel))) ? (await client.get(p(rel))).toString('utf8') : null,
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

async function ftpsTransport(root) {
  const { Client } = await import('basic-ftp');
  requireEnv('DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_PASSWORD');

  const client = new Client(60000);
  // Explicit TLS ("AUTH TLS") with certificate and host name verification (Node's defaults).
  await client.access({
    host: env.DEPLOY_HOST,
    port: Number(env.DEPLOY_PORT || 21),
    user: env.DEPLOY_USER,
    password: env.DEPLOY_PASSWORD,
    secure: true,
    secureOptions: { servername: env.DEPLOY_HOST, rejectUnauthorized: true },
  });
  if (!client.ftp.socket.encrypted) fail('FTPS connection is not encrypted — aborting.');

  const p = (rel) => posix.join(root, rel);
  // 550 = file unavailable (most servers), 551 = some servers' variant of the same.
  const isMissing = (err) => err?.code === 550 || err?.code === 551;
  return {
    // One FTP control connection handles one transfer at a time.
    concurrency: 1,
    read: async (rel) => {
      const chunks = [];
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk);
          cb();
        },
      });
      try {
        await client.downloadTo(sink, p(rel));
      } catch (err) {
        if (isMissing(err)) return null;
        throw err;
      }
      return Buffer.concat(chunks).toString('utf8');
    },
    mkdir: async (rel) => {
      await client.ensureDir(p(rel)); // also changes into the folder; all paths below are absolute
    },
    put: (local, rel) => client.uploadFrom(local, p(rel)),
    write: (rel, text) => client.uploadFrom(Readable.from(Buffer.from(text)), p(rel)),
    remove: (rel) => client.remove(p(rel), true),
    rmdirIfEmpty: async (rel) => {
      const list = await client.list(p(rel)).catch(() => null);
      if (list && list.length === 0) await client.removeEmptyDir(p(rel));
    },
    close: async () => client.close(),
  };
}

function localTransport(root) {
  const p = (rel) => join(root, ...rel.split('/'));
  return {
    concurrency: 4,
    read: async (rel) => (existsSync(p(rel)) ? fs.readFile(p(rel), 'utf8') : null),
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

async function connect(remoteRoot) {
  if (localTarget) return localTransport(localTarget);
  if (protocol === 'sftp') return sftpTransport(remoteRoot);
  if (protocol === 'ftps') return ftpsTransport(remoteRoot);
  return fail(`DEPLOY_PROTOCOL must be "sftp" or "ftps" (got "${protocol}").`);
}

async function main() {
  const remoteRoot = localTarget ?? env.DEPLOY_REMOTE_PATH ?? '';
  if (!localTarget) {
    // Safety: never deploy into anything but a Plesk web root.
    const clean = remoteRoot.replace(/\/+$/, '');
    if (!clean || clean === '/' || !WEB_ROOT_NAMES.includes(posix.basename(clean))) {
      fail(
        `DEPLOY_REMOTE_PATH must point to the web root folder (${WEB_ROOT_NAMES.join(' or ')}), got "${remoteRoot}".`,
      );
    }
  }

  const local = await buildManifest();
  const target = localTarget
    ? `local:${localTarget}`
    : `${protocol}://${env.DEPLOY_HOST}${remoteRoot}`;
  log(`${Object.keys(local).length} files in dist/ → ${target}`);

  const remote = await connect(remoteRoot);
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
      await pool(batch, remote.concurrency, async (rel) => {
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
      JSON.stringify({
        deployedAt: new Date().toISOString(),
        commit: env.GITHUB_SHA ?? null,
        files: local,
      }),
    );
    log(`Done: ${changed.length} uploaded, ${stale.length} deleted.`);
  } finally {
    await remote.close();
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
