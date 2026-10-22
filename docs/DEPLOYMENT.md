# Deployment guide: GitHub → Plesk (kreativmedia.ch)

The site is plain static files (HTML, CSS, JS, images). The server only needs to deliver them; no Node.js
or PHP runs on it. Domain, DNS and e-mail stay at kreativmedia; **nothing in your DNS or e-mail setup
changes.**

```
git push (main) ──▶ GitHub Actions: npm ci → lint → build → upload changed files (SFTP) ──▶ /marioschoch.ch/
```

- `npm run build` produces `dist/`: every page, the RSS feed, sitemap, link-preview images, and an
  `.htaccess` with redirects, caching and security headers.
- `scripts/deploy.mjs` uploads only files that changed and deletes only files that an earlier deploy
  uploaded and that no longer exist. It never touches anything else in the web root (e.g. `.well-known/`
  for Let's Encrypt) and refuses to run if the target isn't the web root folder (`marioschoch.ch`).

**Connection type.** The script supports two encrypted transfer methods:

|                       | **SFTP** (over SSH), **in use**                                                                           | **FTPS** (FTP over TLS), fallback                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Status on your server | **Works on port 2121** (kreativmedia's SSH port; port 22 is firewalled). SSH is enabled in Plesk          | **Works.** Port 21 with TLS 1.3, valid certificate for `*.kreativmedia.ch` (tested) |
| Login                 | SSH key (no password stored at GitHub)                                                                    | Plesk system user + password                                                        |
| Host name             | `venus.kreativmedia.ch` (same server as `marioschoch.ch`)                                                 | **`venus.kreativmedia.ch`** (must match the certificate)                            |
| Server identity       | Pinned via `DEPLOY_KNOWN_HOSTS`; ED25519 fingerprint `SHA256:wroXLPw6o5xZK5BZukvMyOyjyhDSvu0NoXpBp7wIn14` | Checked via the TLS certificate                                                     |

Plain, unencrypted FTP is deliberately not supported. Switching between SFTP and FTPS only means changing
GitHub secrets, not code.

Plan about 30 minutes for the first setup.

---

## 1. Plesk: check the domain and enable HTTPS

Log in to Plesk (link in your kreativmedia customer centre) → **Websites & Domains** → `marioschoch.ch`.

1. **Hosting settings** (_Hosting & DNS → Hosting_, or _Hosting-Einstellungen_):
   - Document root (_Dokumentstamm_): **`marioschoch.ch`**. On kreativmedia it's named after the domain,
     not Plesk's usual `httpdocs`. Leave it as it is.
   - **Preferred domain** (_Bevorzugte Domain_): `marioschoch.ch` (without www). The site's `.htaccess`
     also redirects www → marioschoch.ch, so either way there is only one address.
   - **PHP support:** can be switched **off**. The site doesn't use PHP, and switching it off means less
     to attack.
2. **SSL/TLS certificate (Let's Encrypt, free):** _SSL/TLS-Zertifikate_ → under "Let's Encrypt" click
   **Install** (_Installieren_).
   - Tick **Secure the domain name** and **Include a "www" subdomain**. Without the www certificate, the
     redirect from `https://www.marioschoch.ch` would show a certificate warning.
   - Webmail/mail options: as you like (they don't affect the website).
   - Plesk renews the certificate automatically.
3. Back in the hosting settings, enable **Permanent SEO-safe 301 redirect from HTTP to HTTPS**
   (_Dauerhafte, für SEO geeignete 301-Weiterleitung von HTTP zu HTTPS_). The `.htaccess` does this too;
   having both is fine.
4. **Apache & nginx Settings** (if your plan shows this page): **untick "Serve static files directly by
   nginx"** (sometimes called "Smart static files processing").
   - Reason: with it enabled, nginx delivers JS, CSS, images and fonts itself, and the cache and security
     headers from `.htaccess` are skipped for those files.
   - If you can't change it, the site still works, only with weaker caching. kreativmedia support can
     change it for you.
5. **DNS:** nothing to do. `marioschoch.ch` and `www` already point to this hosting (checked:
   `80.74.145.103` / `2a00:1128:0:157::54`, server `venus.kreativmedia.ch`). **Leave the mail records
   (MX, SPF/TXT, DKIM, DMARC) untouched.**

## 2. Plesk: login details and SSH key for the deploy

The deploy logs in as the Plesk **system user**. That's the same login FTP and SSH use. The password is
only needed once, to install the SSH key (and for the FTPS fallback).

1. _Websites & Domains → marioschoch.ch → Hosting-Einstellungen_ → section **Anmeldedaten für
   Systembenutzer**:
   - **Benutzername:** `marioschoch`
   - **Passwort:** Plesk never shows the current one. If you don't know it, enter a new **strong** password
     (e.g. from a password manager, 20+ characters), click **Speichern**, and keep it somewhere safe.
     Changing it also changes your FTP/SSH login.
2. Test the login in Terminal (type `yes` at the first-connection question; the fingerprint shown must be
   `SHA256:wroXLPw6o5xZK5BZukvMyOyjyhDSvu0NoXpBp7wIn14`):

   ```bash
   sftp -P 2121 marioschoch@marioschoch.ch
   ```

   Enter the password, then `ls` and `bye`. You see the folder **`marioschoch.ch`**: that is the web root
   (Plesk _Dokumentstamm_). Next to it are `logs`, `error_docs` and system folders like `dev`, `etc`, `usr`,
   `var` (they come with the chrooted SSH setting; the deploy never touches them). The deploy path is
   therefore **`/marioschoch.ch`**.

3. Create an SSH key just for deployments and install it on the server. Run the commands one at a time (and
   without comments: zsh doesn't treat `#` as a comment when pasted):

   ```bash
   ssh-keygen -t ed25519 -C "github-deploy marioschoch.ch" -f ~/.ssh/marioschoch_deploy -N ""
   ssh-copy-id -p 2121 -i ~/.ssh/marioschoch_deploy.pub marioschoch@marioschoch.ch
   sftp -P 2121 -i ~/.ssh/marioschoch_deploy marioschoch@marioschoch.ch
   ```

   `ssh-copy-id` asks for the password once and ends with `Number of key(s) added: 1`. The last command must
   log in **without** asking for a password. If `ssh-copy-id` fails, add the public key
   (`~/.ssh/marioschoch_deploy.pub`) in Plesk under _SSH Keys_ instead.

   The key comes as a pair: `marioschoch_deploy.pub` (public, now on the server) and `marioschoch_deploy`
   (private). Whoever has the private key can log in, so it only ever goes into the GitHub secret in step 4.

**FTPS test (only for the fallback):** with [Cyberduck](https://cyberduck.io) or FileZilla, connection type
**FTP-SSL (Explicit AUTH TLS)**, server `venus.kreativmedia.ch`, port `21`, user `marioschoch`, your password.

## 3. GitHub: create the repository

1. <https://github.com/new>: owner `marioschoch`, name e.g. `portfolio`, **public or private** (both work).
   Don't add a README, .gitignore or license.
2. Push the local repository:

   ```bash
   cd ~/Desktop/Projekte/Website
   git remote add origin https://github.com/marioschoch/portfolio.git
   git push -u origin main
   ```

   The first push starts the "Deploy" workflow. It fails until the secrets below exist; that's expected.

## 4. GitHub: add the secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**. Secrets are encrypted
and never shown in logs.

Make sure you're on the **Secrets** tab (not _Variables_) and the names match exactly, including case.

**SFTP (in use):**

| Secret                      | Value                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEPLOY_PROTOCOL`           | `sftp`                                                                                                                                     |
| `DEPLOY_HOST`               | `venus.kreativmedia.ch`                                                                                                                    |
| `DEPLOY_PORT`               | `2121`                                                                                                                                     |
| `DEPLOY_USER`               | `marioschoch`                                                                                                                              |
| `DEPLOY_REMOTE_PATH`        | `/marioschoch.ch`                                                                                                                          |
| `DEPLOY_KNOWN_HOSTS`        | Output of `ssh-keyscan -p 2121 venus.kreativmedia.ch` (`… \| pbcopy`), all lines including the `#` ones. Pins the server's identity        |
| `DEPLOY_PRIVATE_KEY`        | Run `pbcopy < ~/.ssh/marioschoch_deploy` and paste. Must start with `-----BEGIN OPENSSH PRIVATE KEY-----` and end with the `-----END` line |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional, see step 6                                                                                                                       |

No `DEPLOY_PASSWORD` is needed for SFTP; don't store one.

**To fall back to FTPS**, change or add: `DEPLOY_PROTOCOL` = `ftps`, `DEPLOY_PORT` = `21`, and
`DEPLOY_PASSWORD` = the system user password from step 2 (`DEPLOY_HOST` stays `venus.kreativmedia.ch`).

## 5. First deploy and checks

1. GitHub → **Actions → Deploy → Run workflow** (branch `main`), or push any commit.
2. Watch the log. The "Deploy to web root" step prints something like
   `upload: 50 (…) · delete: 0`. The final **Smoke test** fetches a few pages over HTTPS and fails the run
   if one doesn't return 200.
3. Check in the browser:
   - [ ] `https://marioschoch.ch` loads with a valid lock icon.
   - [ ] `http://marioschoch.ch` and `https://www.marioschoch.ch` redirect to `https://marioschoch.ch/`.
   - [ ] `https://marioschoch.ch/about` redirects to `/about/`; `https://marioschoch.ch/nonexistent` shows
         the custom 404 page.
   - [ ] Switch EN/DE, open the command palette (Ctrl/Cmd+K), load the 3D model on the robot project.
4. Check headers: `curl -sI https://marioschoch.ch/ | grep -iE "strict|content-security|cache"`, or
   <https://securityheaders.com/?q=marioschoch.ch>.
5. The old Plesk placeholder page (`index.html`) is overwritten by the first deploy. Other leftover default
   files in `marioschoch.ch/` (e.g. `css/`, `img/`, `favicon.ico` from Plesk's template) aren't deleted
   automatically, because the deploy only removes files it uploaded itself. Delete them once by hand in
   Plesk's File Manager (_Dateien_) or in Cyberduck. **Keep `.well-known/`.**

### When the deploy fails

| Error in the log                                       | Fix                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Missing DEPLOY_…`                                     | A secret is missing or misspelled (names are case-sensitive).                               |
| `DEPLOY_REMOTE_PATH must point to the web root folder` | Set the secret to `/marioschoch.ch`.                                                        |
| `530 Login incorrect`                                  | Wrong user or password. Reset the password in Plesk (step 2) and update the secret.         |
| `Hostname/IP does not match certificate's altnames`    | `DEPLOY_HOST` must be `venus.kreativmedia.ch`, not `marioschoch.ch`.                        |
| `certificate has expired` / `unable to verify`         | kreativmedia's FTP certificate has a problem. Contact support; don't switch off encryption. |
| `Host denied (verification failed)` (SFTP)             | `DEPLOY_KNOWN_HOSTS` doesn't match the server. Run `ssh-keyscan` again.                     |
| `All configured authentication methods failed` (SFTP)  | Key not installed on the server (step 2.3), or `DEPLOY_PRIVATE_KEY` pasted incompletely.    |
| `ECONNREFUSED` / timeout                               | Wrong host/port. SFTP must use port `2121` (port 22 is firewalled).                         |
| Smoke test fails with `000`                            | HTTPS isn't set up yet (step 1.2).                                                          |
| Build fails                                            | A content error (e.g. a missing project field). The log names the file; fix it and push.    |

kreativmedia may temporarily block your IP after many failed logins (fail2ban). If logins suddenly time out
after a few wrong attempts, wait about an hour or ask support.

## 6. Analytics (Cloudflare Web Analytics, cookie-less)

This is only the JavaScript snippet: no Cloudflare DNS, no proxy, nothing changes at kreativmedia.

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. **Analytics & Logs → Web Analytics → Add a site** → hostname `marioschoch.ch`.
   - Choose the manual **JS snippet** option (not automatic setup).
   - Copy the `token` value from the snippet (`data-cf-beacon='{"token": "…"}'`).
3. Add it as the GitHub secret `PUBLIC_CF_ANALYTICS_TOKEN` and run the deploy again.

No cookies are set, so no cookie banner is needed. Mention the analytics in a short privacy note if you add
one. The CSP in `.htaccess` already allows the beacon (`static.cloudflareinsights.com`,
`cloudflareinsights.com`).

## 7. Rolling back

Every commit is a complete version of the site, and the deploy only syncs differences, so a rollback is
just a deploy of an older commit:

- **Quick:** GitHub → **Actions → Deploy → Run workflow** → in "ref" enter the commit SHA (or tag) of the
  last good version (find it under _Code → Commits_) → Run. The server then matches that commit.
  The next push to `main` deploys `main` again.
- **Permanent:** undo the bad change in Git and push:

  ```bash
  git revert <bad-commit-sha>
  git push
  ```

- **If files on the server got out of sync** (e.g. manual edits in the File Manager), run the workflow with
  **"full"** ticked to upload everything again.

## 8. Deploying from your Mac (optional)

The same script works locally, with the secrets as environment variables:

```bash
npm run build
export DEPLOY_PROTOCOL=sftp DEPLOY_HOST=venus.kreativmedia.ch DEPLOY_PORT=2121 \
       DEPLOY_USER=marioschoch DEPLOY_REMOTE_PATH=/marioschoch.ch
export DEPLOY_KNOWN_HOSTS="$(ssh-keyscan -p 2121 venus.kreativmedia.ch 2>/dev/null)"
export DEPLOY_PRIVATE_KEY="$(cat ~/.ssh/marioschoch_deploy)"
npm run deploy:dry     # shows what would change; use `npm run deploy` to actually upload
```

**Note:** your Desktop folder is synced with iCloud Drive. If you ever see files like `index 2.html` in
`dist/`, those are iCloud sync duplicates. Delete `dist/` and run `npm run build` again before a local
deploy. Deploys from GitHub always start from a clean build, so this doesn't affect them. Moving the project
out of the iCloud-synced Desktop (e.g. to `~/Projekte/Website`) avoids the problem entirely and also keeps
iCloud from syncing the large `node_modules` folder.

## 9. Snake leaderboard (the only PHP)

The shared top-10 board on `/snake/` is served by `public/api/snake-scores.php`, so **PHP must be
enabled for the domain** in Plesk (Websites & Domains → PHP; any version from 7.4 works). The deploy's
smoke test fails if the API does not answer with JSON.

Scores are stored in `private/snake/` next to the web root (Plesk's non-public `private` folder). If
that folder is not writable, the script falls back to `api/.snake-data/` inside the web root (blocked
by the dotfile rule in `.htaccess`). Deploys never touch either folder.

The board has one row per player: their best score and how many games (tries) they have played.
A player is a random ID kept in the browser, so names are unique: the first browser to use a name
owns it, and another browser or phone counts as a new player.

- **Remove a player or reset the board:** delete their entry from `players.json` there, or the whole
  file (via SFTP or the Plesk file manager). Each entry is keyed by a hash of the player's ID and holds
  `name`, `best`, `tries`, `date` (of the best score) and `at`.
- `scores.json` is the earlier one-row-per-game board. On the first request after the update it is
  merged into `players.json` by name (tries = number of rows); those rows go to the first browser that
  claims the name. After that the file is no longer used and can be deleted.
- `secret.key` signs the start tokens and hashes the player IDs; `recent.json` holds used tokens and the
  name-change rate limit (hashed IPs, kept for two hours).

## What's in `public/.htaccess`

| Section      | What it does                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirects    | www → `marioschoch.ch`, http → https, `/x/index.html` and `/x.html` → `/x/`, `/about` → `/about/` (always to https, also behind Plesk's nginx proxy)                                                                                   |
| 404          | `ErrorDocument 404 /404.html` with a real 404 status; no directory listings                                                                                                                                                            |
| Hidden files | All dotfiles (`.htaccess`, `.deploy-manifest.json`) return 403; `.well-known/` stays reachable for Let's Encrypt                                                                                                                       |
| Compression  | brotli if the server has it, gzip otherwise                                                                                                                                                                                            |
| Caching      | `/_astro/*` (file names change on every build): 1 year, immutable. HTML/XML: always revalidated. Images, models, PDFs: 1 week                                                                                                          |
| Security     | HSTS (1 year, without `includeSubDomains`, so e.g. webmail without HTTPS keeps working), `nosniff`, Referrer-Policy, Permissions-Policy, no framing, and a Content Security Policy                                                     |
| CSP          | Scripts only from the site itself plus build-time SHA-256 hashes of Astro's inline scripts (filled in by `scripts/csp-hashes.mjs`), plus the Cloudflare Analytics beacon. `'wasm-unsafe-eval'` and `blob:` are needed by the 3D viewer |

If you add a third-party embed later (e.g. a YouTube video), its domain must be added to the CSP in
`public/.htaccess` (`frame-src https://www.youtube-nocookie.com`, for example), or the browser blocks it.
