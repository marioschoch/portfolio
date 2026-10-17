# What I still need to provide

## Hosting setup (one-time, details in docs/DEPLOYMENT.md)

**Plesk (kreativmedia):**

- [ ] Let's Encrypt certificate for `marioschoch.ch` **including www** (SSL/TLS Certificates)
- [ ] Hosting settings: preferred domain `marioschoch.ch`, "Permanent SEO-safe 301 redirect from HTTP to HTTPS"
- [ ] Apache & nginx Settings: untick "Serve static files directly by nginx" (or ask support)
- [ ] Set/note the system user password (Hosting-Einstellungen → Anmeldedaten für Systembenutzer)
- [ ] Test the login with Cyberduck/FileZilla: FTP over explicit TLS, `venus.kreativmedia.ch`, port 21 —
      confirm you see the `marioschoch.ch` folder (= Plesk Dokumentstamm)
- [ ] Optional: ask kreativmedia to open SSH port 22 if you'd rather use SFTP with an SSH key
- [ ] After the first deploy: delete Plesk's leftover default files in `marioschoch.ch/` (keep `.well-known/`)

**GitHub:**

- [ ] Create the repository and `git push -u origin main`
- [ ] Secrets: `DEPLOY_PROTOCOL`=`ftps`, `DEPLOY_HOST`=`venus.kreativmedia.ch`, `DEPLOY_PORT`=`21`,
      `DEPLOY_USER`=`marioschoch`, `DEPLOY_PASSWORD`, `DEPLOY_REMOTE_PATH`=`/marioschoch.ch`
- [ ] Optional: `PUBLIC_CF_ANALYTICS_TOKEN` (Cloudflare Web Analytics site for `marioschoch.ch`, JS snippet)
- [ ] Run Actions → Deploy → Run workflow, then check the site, the redirects and the 404 page

## Content

Run `npm run todos` to list every placeholder in the code. Each item below says where it goes.

### Decisions

- [ ] **Internship availability**: `site.ts → availableFrom`, e.g. `{ en: 'February 2027', de: 'Februar 2027' }`.
- [ ] **Public e-mail**: confirm `site.ts → email` (currently your Gmail address).

### Files

- [ ] **CV PDF** → `public/cv/Mario-Schoch-CV.pdf` (exact file name)
- [ ] **Portrait photo** → `src/assets/portrait.jpg` (portrait format, ≥ 800 px wide), then follow the comment in
      `about.astro`
- [ ] **Project photos** (per project: 1 cover + 2–6 gallery images, each with a one-line description of what's
      visible)
  - [ ] Delivery robot: robot on the track, motor shield, shooter mechanism, web interface screenshot
  - [ ] BMC Hinge Fork: CAD model, FE stress plot, comparison chart
  - [ ] VELOVE website: desktop + mobile screenshots
- [ ] **3D model** of the robot (GLB, < 5 MB) → replaces the placeholder `public/models/delivery-robot.glb`
- [ ] **Report PDF** for the Hinge Fork analysis (optional) → `public/files/`, then `links.report` in its `index.mdx`

### Texts (everything marked TODO)

- [ ] **Projects** (`src/content/projects/*/index.mdx`): role, dates, team size, tools, key figures and the
      problem → approach → result text. **All numbers are invented placeholders.**
- [ ] **Updates** (`src/content/updates/*.md`): replace the six example entries with real ones (or delete
      them).
- [ ] **CV** (`src/data/cv.ts`): school, start dates, work experience, skills, language levels, awards
- [ ] **About** (`src/pages/[...lang]/about.astro`): intro, story, what you're looking for, beyond engineering
- [ ] **Now** (`src/data/now.ts`): 2–4 current items
- [ ] **German translation** of the robot project (`delivery-robot/de.mdx`): review once the English text
      is final. Add `de.mdx` for other projects whenever you like.

### Links

- [ ] GitHub repository URLs for each project (currently your profile as a placeholder)
- [ ] VELOVE website URL (`velove-website/index.mdx → links.website`)
- [ ] LinkedIn: make sure your profile URL in `site.ts` is the public one you want to share

## Before sending applications

- [ ] `npm run todos` shows nothing in `src/`
- [ ] Check every page on your phone in light and dark mode
- [ ] Test the LinkedIn link preview (Post Inspector) for the home page and one project
