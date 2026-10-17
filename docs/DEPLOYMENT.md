# Deployment guide

From your local folder to a live site at your own domain, all on free tiers. Plan about 45 minutes, plus
waiting time for DNS.

**Overview**

```
your Mac ──git push──▶ GitHub (repo) ──webhook──▶ Cloudflare Workers Builds
                                                   └─ npm run build → wrangler deploy → <your domain>
```

The site is deployed as a **Cloudflare Worker with static assets**, which Cloudflare now recommends for
static sites instead of Cloudflare Pages. No Worker code runs: Cloudflare serves the files from `dist/`
according to `wrangler.jsonc`.

---

## 1. Create the GitHub repository

The local folder is already a Git repository with commits on `main`.

1. Go to <https://github.com/new>.
   - Owner: `marioschoch`, name e.g. `portfolio`.
   - Visibility: **public** or **private**. Both work with Cloudflare. Public lets recruiters see the code;
     private keeps drafts hidden.
   - Do **not** add a README, .gitignore or license (the repo already has them).
2. Connect and push (GitHub shows these commands too):

   ```bash
   cd ~/Desktop/Projekte/Website
   git remote add origin https://github.com/marioschoch/portfolio.git
   git push -u origin main
   ```

   If asked for a password, use a [personal access token](https://github.com/settings/tokens) or sign in with
   `gh auth login` (GitHub CLI).

3. Under **Actions** on GitHub you will see the "CI" workflow run (lint + build). A green check means the
   code is fine.

## 2. Create the Cloudflare project (connected to GitHub)

1. Create a free account at <https://dash.cloudflare.com/sign-up> (if you don't have one).
2. Dashboard → **Workers & Pages** → **Create** → **Import a repository** (on the Workers tab).
3. **Connect GitHub**, authorise the Cloudflare app (granting access to just the `portfolio` repository is
   enough) and select the repository.
4. Configure the build:

   | Setting           | Value                                                        |
   | ----------------- | ------------------------------------------------------------ |
   | Project name      | `marioschoch-portfolio`, matching `name` in `wrangler.jsonc` |
   | Production branch | `main`                                                       |
   | Build command     | `npm run build`                                              |
   | Deploy command    | `npx wrangler deploy`                                        |
   | Root directory    | `/` (leave empty)                                            |

5. **Create and deploy.** The first build takes 1–2 minutes. The site is then live at
   `https://marioschoch-portfolio.<your-subdomain>.workers.dev`.

From now on **every push to `main` deploys automatically.** Pushes to other branches create preview
versions you can find under the Worker → _Deployments_ (useful for trying out changes).

If a build fails, open the Worker → **Deployments** → the failed build → **View build log**. The error is
usually a content field the schema rejects, and the log names the file.

## 3. Cloudflare Web Analytics (free, cookie-less)

No cookie banner is needed: Web Analytics stores no cookies and no personal data.

1. Dashboard → **Analytics & Logs → Web Analytics** → **Add a site** → enter your domain → choose the
   **JS snippet** option, and copy the `token` value from the snippet (`{"token": "…"}`).
2. Worker → **Settings → Build → Variables and secrets** → add
   `PUBLIC_CF_ANALYTICS_TOKEN` = the token. Save.
3. Trigger a new deployment (push any commit, or _Deployments → Retry build_).

The site only adds the beacon in production builds when the token is set (see `BaseLayout.astro`).

> Once your domain is on Cloudflare (step 4), Web Analytics can also inject itself automatically.
> **Use only one of the two methods**, or every visit is counted twice.

## 4. Connect your domain

First, a constraint: **a Worker can only use a custom domain whose DNS is managed by Cloudflare.** There
are two ways to give Cloudflare your domain, plus a fallback.

### Option A (recommended): move the nameservers to Cloudflare

The domain stays registered at your registrar (you keep paying there). Only DNS moves to Cloudflare, free.
This is the standard setup and the only one that supports the root domain (`yourname.ch`) on the free plan.

1. Cloudflare dashboard → **Add a domain** → enter `yourdomain.ch` → **Free** plan.
2. Cloudflare scans your existing DNS records. **Compare them carefully with the DNS zone at your registrar**
   (log in at the registrar → DNS / zone editor) before continuing. See "Records you must not break" below.
   Add anything that is missing by hand.
3. If **DNSSEC** is enabled at your registrar, **turn it off first** (otherwise the domain stops resolving
   after the switch). You can re-enable it through Cloudflare later.
4. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`). At your
   registrar, replace the existing nameservers with these two. For `.ch` domains this is done at the
   registrar; it can take minutes to a few hours, and Cloudflare e-mails you when the domain is active.
5. Connect the domain to the Worker: Worker → **Settings → Domains & Routes → Add → Custom domain** →
   `yourdomain.ch`. Repeat for `www.yourdomain.ch`. Cloudflare creates the DNS records and the HTTPS
   certificate automatically.
6. Redirect `www` → root (or the other way round) so there is one canonical address: Cloudflare →
   your domain → **Rules → Redirect Rules → Create rule** → template "Redirect from WWW to root".
   (Alternative: only attach the root domain to the Worker and add a proxied `CNAME www → yourdomain.ch`
   plus the redirect rule.)
7. Update the domain in the code (it is used for canonical URLs, sitemap, RSS and link previews):
   - `src/data/site.ts` → `url`
   - `astro.config.ts` → `site`
   - `public/robots.txt` → `Sitemap:` line

   Commit and push.

8. Re-enable DNSSEC: Cloudflare → your domain → **DNS → Settings → Enable DNSSEC**, then add the DS record
   it shows at your registrar.

### Option B: keep DNS at the registrar (DNS records only)

Workers custom domains don't work with an external DNS provider. Cloudflare's "partial (CNAME) setup"
exists, but only on the Business plan (paid), so it isn't an option here. What you can do without moving
nameservers:

- Use the free `*.workers.dev` address, and at your registrar set up a **URL redirect / forwarding**
  from `yourdomain.ch` to it. This is easy, but visitors see the workers.dev URL, which looks less
  professional, and link previews show the wrong domain.

**Recommendation: Option A.** It's free, and your registrar stays the owner of record. Moving nameservers is
fully reversible: set the old nameservers back at the registrar.

### Records you must not break (e-mail and verification)

Moving nameservers means Cloudflare answers **all** DNS questions for your domain from then on. Any record
missing in Cloudflare stops working. Check your registrar's zone for these and make sure Cloudflare has
identical copies **before** step 4:

| Type            | Name                                            | Purpose                                                                                                                                 | Notes                                                  |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `MX`            | `@`                                             | Where e-mail for `@yourdomain.ch` is delivered (registrar mailbox, Google Workspace, Proton, or the registrar's free e-mail forwarding) | Copy exactly, including priority. MX can't be proxied. |
| `TXT`           | `@`                                             | **SPF**, e.g. `v=spf1 include:… ~all`: which servers may send mail as your domain                                                       | Only one SPF record per name.                          |
| `TXT` / `CNAME` | `*._domainkey`                                  | **DKIM** signing keys                                                                                                                   | Set CNAMEs to **DNS only** (grey cloud).               |
| `TXT`           | `_dmarc`                                        | **DMARC** policy                                                                                                                        |                                                        |
| `TXT`           | `@`                                             | Verifications (Google Search Console, etc.)                                                                                             |                                                        |
| `A` / `CNAME`   | `mail`, `webmail`, `autodiscover`, `autoconfig` | Mail client setup at the registrar                                                                                                      | Set to **DNS only**.                                   |

Rule of thumb: **anything related to e-mail must be "DNS only" (grey cloud)**, never "Proxied" (orange
cloud). Only the website records are proxied.

**Your current situation:** you use Gmail (`@gmail.com`), so there is probably **no e-mail on the domain yet**,
and nothing can break. If you later want `mario@yourdomain.ch`, you can add **Cloudflare Email Routing**
(free) to forward it to Gmail.
Cloudflare then creates the needed MX/SPF records itself.

If your registrar offers e-mail forwarding and you've activated it, it uses MX records pointing to the
registrar. Copy them to Cloudflare, or switch to Cloudflare Email Routing.

## 5. Check the live site

- [ ] `https://yourdomain.ch` loads with a valid HTTPS lock; `http://` and `www.` redirect to it.
- [ ] `https://yourdomain.ch/nonexistent` shows the custom 404 page.
- [ ] `https://yourdomain.ch/sitemap-index.xml` and `/rss.xml` show your domain (not the placeholder).
- [ ] Paste a project URL into the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to see
      (and refresh) the link preview.
- [ ] Add the domain to [Google Search Console](https://search.google.com/search-console) (DNS TXT
      verification via Cloudflare) and submit `sitemap-index.xml`.
- [ ] Run [PageSpeed Insights](https://pagespeed.web.dev/) on the home page.

## Manual deploy (optional)

You can also deploy from your Mac without GitHub:

```bash
npx wrangler login     # once
npm run deploy         # build + wrangler deploy
```

## Costs

All free: GitHub (repo + Actions minutes), Cloudflare Workers free plan (static asset requests are free and
unlimited), Workers Builds (free build minutes per month), Web Analytics, DNS, Email Routing. Your only cost
is the domain at your registrar.
