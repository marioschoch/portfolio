# Deployment guide: GitHub → Plesk (kreativmedia.ch)

The site is plain static files (HTML, CSS, JS, images). The server only needs to deliver them; no Node.js
or PHP runs on it. Domain, DNS and e-mail stay at kreativmedia; **nothing in your DNS or e-mail setup
changes.**

```
git push (main) ──▶ GitHub Actions: npm ci → lint → build → upload changed files via SFTP ──▶ httpdocs/
```

- `npm run build` produces `dist/`: every page, the RSS feed, sitemap, link-preview images, and an
  `.htaccess` with redirects, caching and security headers.
- `scripts/deploy-sftp.mjs` uploads only files that changed and deletes only files that an earlier deploy
  uploaded and that no longer exist. It never touches anything else in `httpdocs` (e.g. `.well-known/`
  for Let's Encrypt) and refuses to run if the target folder isn't called `httpdocs`.

Plan about 45 minutes for the first setup.

---

## 1. Plesk: check the domain and enable HTTPS

Log in to Plesk (link in your kreativmedia customer centre) → **Websites & Domains** → `marioschoch.ch`.

1. **Hosting settings** (_Hosting & DNS → Hosting_, or _Hosting Settings_ in older layouts):
   - Document root: `httpdocs` (the default).
   - **Preferred domain:** `marioschoch.ch` (without www). The site's `.htaccess` also redirects
     www → marioschoch.ch, so either way there is only one address.
   - **PHP support:** can be switched **off**. The site doesn't use PHP, and switching it off means less
     to attack. Leave it on if you host something else on this subscription that needs it.
2. **SSL/TLS certificate (Let's Encrypt, free):** _SSL/TLS Certificates_ → under "Let's Encrypt" click
   **Install** (or "Get it free").
   - Tick **Secure the domain name** and **Include a "www" subdomain**. Without the www certificate, the
     redirect from `https://www.marioschoch.ch` would show a certificate warning.
   - Webmail/mail options: as you like (they don't affect the website).
   - Plesk renews the certificate automatically.
3. Back in the hosting settings, enable **Permanent SEO-safe 301 redirect from HTTP to HTTPS**. The
   `.htaccess` does this too; having both is fine.
4. **Apache & nginx Settings** (if your plan shows this page): **untick "Serve static files directly by
   nginx"** (sometimes called "Smart static files processing").
   - Reason: with it enabled, nginx delivers JS, CSS, images and fonts itself, and the cache and security
     headers from `.htaccess` are skipped for those files.
   - If you can't change it, the site still works, only with weaker caching. kreativmedia support can
     change it for you.
5. Check **DNS settings**: the `A` (and `AAAA`) records for `marioschoch.ch` and `www.marioschoch.ch`
   should point to this hosting. That is normally already the case when domain and hosting are both at
   kreativmedia. **Leave the mail records (MX, SPF/TXT, DKIM, DMARC) untouched.**

## 2. Plesk: enable SFTP access

The deploy needs an SFTP login that can write to `httpdocs`.

1. _Websites & Domains → marioschoch.ch → Hosting & DNS → Hosting_ (or "Web Hosting Access") →
   **Access to the server over SSH**.
   - Choose **`/bin/bash (chrooted)`** if available (you'll be locked into your own web space, which is
     what you want). Otherwise any SSH/SFTP option your plan offers.
   - If the option is missing or greyed out, SSH/SFTP isn't enabled on your plan. **Ask kreativmedia
     support to enable SFTP/SSH access for the subscription.** It's usually free, possibly limited to
     certain plans.
2. Note the **username** shown on the same page (the system user, often the subscription name) and set a
   strong **password** there if you don't know it.
3. **Host name:** use the server name from kreativmedia's welcome e-mail or Plesk's "Connection Info"
   (the FTP/SSH host). `marioschoch.ch` itself also works once it points to this server. **Port:** usually
   `22`.
4. Test from your Mac (Terminal):

   ```bash
   sftp -P 22 USERNAME@HOST
   sftp> pwd          # shows where you are, e.g. "/" (chrooted) or /var/www/vhosts/marioschoch.ch
   sftp> ls           # you should see httpdocs (and logs, etc.)
   sftp> exit
   ```

   The **remote path** for the deploy is the `httpdocs` folder as seen in this session: usually
   **`/httpdocs`** (chrooted) or **`/var/www/vhosts/marioschoch.ch/httpdocs`**.

### Recommended: log in with an SSH key instead of a password

A key can't be guessed and can be revoked separately. Create one just for deployments:

```bash
ssh-keygen -t ed25519 -C "github-deploy marioschoch.ch" -f ~/.ssh/marioschoch_deploy -N ""
```

This creates `~/.ssh/marioschoch_deploy` (private, goes into GitHub) and `~/.ssh/marioschoch_deploy.pub`
(public, goes onto the server). Put the public key on the server in **one** of these ways:

- **Plesk "SSH Keys"** (_Websites & Domains → SSH Keys_, if your plan has it): **Add key** and paste the
  content of `marioschoch_deploy.pub`.
- **Manually via SFTP** (works with chrooted access): in your web space home, create `.ssh/authorized_keys`
  containing the `.pub` line:

  ```bash
  sftp -P 22 USERNAME@HOST
  sftp> mkdir .ssh
  sftp> put ~/.ssh/marioschoch_deploy.pub .ssh/authorized_keys
  sftp> chmod 700 .ssh
  sftp> chmod 600 .ssh/authorized_keys
  sftp> exit
  sftp -i ~/.ssh/marioschoch_deploy -P 22 USERNAME@HOST   # must log in without a password
  ```

If key login doesn't work on your plan, use the password: the workflow supports both.

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

| Secret                      | Value                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SFTP_HOST`                 | Server host name from step 2                                                                                                                            |
| `SFTP_PORT`                 | `22` (or what kreativmedia tells you)                                                                                                                   |
| `SFTP_USER`                 | Plesk system user from step 2                                                                                                                           |
| `SFTP_REMOTE_PATH`          | `/httpdocs` or `/var/www/vhosts/marioschoch.ch/httpdocs` (whatever `pwd` + `ls` showed)                                                                 |
| `SFTP_PRIVATE_KEY`          | The **whole** content of `~/.ssh/marioschoch_deploy`, including the `-----BEGIN…` / `-----END…` lines. Get it with `pbcopy < ~/.ssh/marioschoch_deploy` |
| `SFTP_PASSWORD`             | **Only if you don't use a key.** The SFTP password                                                                                                      |
| `SFTP_KNOWN_HOSTS`          | Output of `ssh-keyscan -p 22 HOST` (paste all lines). Pins the server's identity, so the deploy can't be redirected to another machine                  |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional, see step 6                                                                                                                                    |

Check the `ssh-keyscan` output once against the fingerprint in Plesk or from support, or at least run it
from your home network rather than public Wi-Fi.

## 5. First deploy and checks

1. GitHub → **Actions → Deploy → Run workflow** (branch `main`), or push any commit.
2. Watch the log. The "Deploy to httpdocs" step prints something like
   `upload: 52 (…) · delete: 0`. The final **Smoke test** fetches a few pages over HTTPS and fails the run
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
   files in `httpdocs` (e.g. `css/`, `img/`, `favicon.ico` from Plesk's template) aren't deleted
   automatically, because the deploy only removes files it uploaded itself. Delete them once by hand in
   Plesk's File Manager. **Keep `.well-known/`.**

### When the deploy fails

| Error in the log                                     | Fix                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Missing SFTP_…`                                     | A secret is missing or misspelled (names are case-sensitive).                                                             |
| `SFTP_REMOTE_PATH must point to the httpdocs folder` | Set the secret to the full path ending in `httpdocs`.                                                                     |
| `Host denied (verification failed)`                  | `SFTP_KNOWN_HOSTS` doesn't match the server; run `ssh-keyscan` again (the server key may have changed after maintenance). |
| `All configured authentication methods failed`       | Wrong user/password, or the public key isn't installed on the server.                                                     |
| `ECONNREFUSED` / timeout                             | Wrong host/port, or SSH isn't enabled for the subscription.                                                               |
| Smoke test fails with `000`                          | HTTPS isn't set up yet (step 1.2), or DNS doesn't point to the hosting.                                                   |
| Build fails                                          | A content error (e.g. a missing project field). The log names the file; fix it and push.                                  |

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
SFTP_HOST=… SFTP_USER=… SFTP_REMOTE_PATH=/httpdocs \
SFTP_PRIVATE_KEY="$(cat ~/.ssh/marioschoch_deploy)" SFTP_KNOWN_HOSTS="$(ssh-keyscan -p 22 HOST)" \
npm run deploy:dry     # shows what would change; use `npm run deploy` to actually upload
```

## What's in `public/.htaccess`

| Section     | What it does                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirects   | www → `marioschoch.ch`, http → https, `/x/index.html` and `/x.html` → `/x/`, `/about` → `/about/` (always to https, also behind Plesk's nginx proxy)                                                                                   |
| 404         | `ErrorDocument 404 /404.html` with a real 404 status; no directory listings                                                                                                                                                            |
| Compression | brotli if the server has it, gzip otherwise                                                                                                                                                                                            |
| Caching     | `/_astro/*` (file names change on every build): 1 year, immutable. HTML/XML: always revalidated. Images, models, PDFs: 1 week                                                                                                          |
| Security    | HSTS (1 year, without `includeSubDomains`, so e.g. webmail without HTTPS keeps working), `nosniff`, Referrer-Policy, Permissions-Policy, no framing, and a Content Security Policy                                                     |
| CSP         | Scripts only from the site itself plus build-time SHA-256 hashes of Astro's inline scripts (filled in by `scripts/csp-hashes.mjs`), plus the Cloudflare Analytics beacon. `'wasm-unsafe-eval'` and `blob:` are needed by the 3D viewer |

If you add a third-party embed later (e.g. a YouTube video), its domain must be added to the CSP in
`public/.htaccess` (`frame-src https://www.youtube-nocookie.com`, for example), or the browser blocks it.
