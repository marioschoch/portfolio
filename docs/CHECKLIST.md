# What I still need to provide

## Hosting setup (one-time, details in docs/DEPLOYMENT.md)

**Plesk (kreativmedia):**

- [x] Let's Encrypt certificate for `marioschoch.ch` **including www** (SSL/TLS Certificates)
- [x] Hosting settings: preferred domain `marioschoch.ch`, "Permanent SEO-safe 301 redirect from HTTP to HTTPS"
- [x] Apache & nginx Settings: untick "Serve static files directly by nginx" (or ask support)
- [x] Set/note the system user password (Hosting-Einstellungen → Anmeldedaten für Systembenutzer)
- [x] Test the SFTP login: `sftp -P 2121 marioschoch@marioschoch.ch` — the `marioschoch.ch` folder is the
      Plesk Dokumentstamm
- [x] Deploy SSH key `~/.ssh/marioschoch_deploy` created and installed on the server (`ssh-copy-id -p 2121`)
- [x] After the first deploy: delete Plesk's leftover default files in `marioschoch.ch/` (keep `.well-known/`)

**GitHub:**

- [x] Create the repository and `git push -u origin main`
- [x] Secrets: `DEPLOY_PROTOCOL`=`sftp`, `DEPLOY_HOST`=`venus.kreativmedia.ch`, `DEPLOY_PORT`=`2121`,
      `DEPLOY_USER`=`marioschoch`, `DEPLOY_REMOTE_PATH`=`/marioschoch.ch`, `DEPLOY_KNOWN_HOSTS`,
      `DEPLOY_PRIVATE_KEY` (no `DEPLOY_PASSWORD`)
- [ ] Optional: `PUBLIC_CF_ANALYTICS_TOKEN` (Cloudflare Web Analytics site for `marioschoch.ch`, JS snippet)
- [x] Run Actions → Deploy → Run workflow, then check the site, the redirects and the 404 page

## Content

Run `npm run todos` to list every placeholder in the code. Each item below says where it goes.

### Decisions

- [ ] **Internship availability**: `site.ts → availableFrom`, e.g. `{ en: 'February 2027', de: 'Februar 2027' }`.
- [ ] **Public e-mail**: confirm `site.ts → email` (currently your Gmail address).

### Files

- [ ] **CV PDF** → `npm run cv:pdf` after every change to `src/data/cv.ts`, then commit `public/cv/*.pdf`
- [ ] **Portrait photo** → `src/assets/portrait.jpg` (portrait format, ≥ 800 px wide), shown on the CV page
- [ ] **Project photos** (per project: 1 cover + 2–6 gallery images, each with a one-line description of what's
      visible)
  - [ ] Delivery robot: robot on the track, shooter, pickup wheel, web interface screenshot (the page shows CAD
        renders so far)
  - [ ] BMC Hinge Fork: CAD model, FE stress plot, comparison chart
  - [ ] VELOVE website: desktop + mobile screenshots
- [x] **3D models** of the robot: shooter V3.5 and funnel V03 in `public/models/delivery-robot-*.glb` (made with
      `scripts/step-to-glb.py`); add more parts in `src/components/projects/delivery-robot/DeliveryRobot.astro`
- [ ] **Report PDF** for the Hinge Fork analysis (optional) → `public/files/`, then `links.report` in its `index.mdx`

### Texts (everything marked TODO)

- [ ] **Projects** (`src/content/projects/*/index.mdx`): role, dates, team size, tools, key figures and the
      problem → approach → result text. **All numbers are invented placeholders.**
- [ ] **Updates** (`src/content/updates/*.md`): replace the six example entries with real ones (or delete
      them).
- [ ] **CV** (`src/data/cv.ts`): school, start dates, work experience, skills, language levels, awards
- [ ] **Now** (`src/data/now.ts`): 2–4 current items
- [ ] **Delivery robot and learnanatomy** (`index.mdx` and `de.mdx`): drafts from the project files, marked
      TODO. Check the facts (especially your role on the robot) and put them in your own words.

### Links

- [ ] GitHub repository URLs for each project (currently your profile as a placeholder)
- [ ] VELOVE website URL (`velove-website/index.mdx → links.website`)
- [ ] LinkedIn: make sure your profile URL in `site.ts` is the public one you want to share

## Before sending applications

- [ ] `npm run todos` shows nothing in `src/`
- [ ] Check every page on your phone in light and dark mode
- [ ] Test the LinkedIn link preview (Post Inspector) for the home page and one project
