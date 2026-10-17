# marioschoch.ch — personal portfolio

Static portfolio site built with **Astro 7**, **TypeScript**, **Tailwind CSS 4** and **MDX**. It is hosted on
Plesk shared hosting at kreativmedia.ch (Apache, no Node.js on the server) and deployed automatically via
GitHub Actions and FTPS on every push to `main`.

```bash
npm install
npm run dev        # http://localhost:4321 — live reload
npm run build      # type check + production build into dist/ (+ CSP hashes in dist/.htaccess)
npm run preview    # serve dist/ locally (http://localhost:4321; ignores .htaccess)
npm run deploy:dry # show what a deploy would upload/delete (needs DEPLOY_* env vars, see docs)
npm run lint       # ESLint
npm run format     # Prettier
npm run todos      # list every remaining TODO placeholder
```

Requires Node 22.22+ (see `.node-version`).

---

## Project structure

```
src/
├─ content.config.ts          # Zod schemas — the build fails on missing/invalid fields
├─ content/
│  ├─ projects/<slug>/        # one folder per project
│  │  ├─ index.mdx            #   English write-up + all specs (source of truth)
│  │  ├─ de.mdx               #   optional German translation (texts only)
│  │  └─ *.jpg / *.png        #   images used by this project
│  └─ updates/*.md            # project log entries (linked to a project)
├─ data/
│  ├─ site.ts                 # name, domain, links, e-mail, status line, availability
│  ├─ cv.ts                   # CV data (single source for the /cv page)
│  └─ now.ts                  # "Now" box on the home page
├─ i18n/ui.ts                 # all UI strings in English + German
├─ pages/[...lang]/           # every page exists once and renders at /… and /de/…
├─ components/  layouts/  lib/  styles/
public/
├─ cv/Mario-Schoch-CV.pdf     # your uploaded CV (download/view buttons appear automatically)
├─ models/*.glb               # 3D models
└─ files/                     # other downloads (e.g. report PDFs)
```

---

## How to add a project

1. Create a folder named after the URL slug, e.g. `src/content/projects/bike-stand/`.
2. Add `index.mdx` (copy an existing project as a template):

   ```mdx
   ---
   title: Folding Bike Repair Stand
   summary: One or two sentences (40–220 characters) — used on cards, in search results and link previews.
   role: Design & build
   timeframe:
     start: 2026-03-01
     end: 2026-05-30 # omit while ongoing
   teamSize: 1
   tools: [SolidWorks, ANSYS, 3D printing]
   tags: [cad, bikes] # allowed: mechatronics, embedded, cad, analysis, web, bikes
   status: completed # or in-progress
   featured: true # show on the home page (max. 3 are shown)
   order: 1 # lower = earlier in lists
   cover: { src: ./cover.jpg, alt: Repair stand folded next to a road bike }
   gallery:
     - { src: ./detail-clamp.jpg, alt: Close-up of the quick-release clamp, caption: Clamp v2 }
   links:
     github: https://github.com/marioschoch/bike-stand
     report: /files/bike-stand-report.pdf
     video: https://youtu.be/…
   keyFigures:
     - { value: '2.4', unit: kg, label: Total mass }
     - { value: '40', unit: '%', label: Smaller when folded }
   ---

   ## Problem

   …

   ## Approach

   …

   ## Result

   …
   ```

3. Run `npm run dev`. If a required field is missing or wrong (e.g. a typo in a tag, an alt text that is too
   short), the dev server and the build show an error that names the file and field.

New tags: add them to `projectTags` in `src/content.config.ts`. The filter buttons update automatically.

**Reading time** and **"last updated"** are computed automatically. "Last updated" is the latest of `updated`
(optional frontmatter field), the newest project update, and the timeframe dates.

## How to post an update

Create a Markdown file in `src/content/updates/`, named `YYYY-MM-DD-short-title.md`:

```md
---
title: Shooter v3 tested
date: 2026-04-02
project: delivery-robot # must match a project folder name — typos fail the build
summary: Optional one-line teaser for the feed/RSS (otherwise the first paragraph is used).
---

What happened, what you measured, what's next.
```

It appears in the project's log, in the global **Updates** feed, on the home page (latest three) and in
`/rss.xml`.

## How to edit the CV

- **Web version:** edit `src/data/cv.ts`. Text fields are either a plain string or `{ en: '…', de: '…' }`.
  Projects are referenced by folder name, so titles and links stay in sync. Empty lists (e.g. `awards: []`)
  hide their section.
- **PDF:** export your CV as PDF and save it as **`public/cv/Mario-Schoch-CV.pdf`**. On the next build the
  "Download PDF" and "View PDF" buttons appear on `/cv`. Updating the CV means replacing this one file. The
  file name is set in `site.ts → cvPdf`.
- The page also prints cleanly on A4 ("Print" button or Ctrl/Cmd+P).

## How to add images

- Put images **next to the project's `index.mdx`** and reference them relatively (`./photo.jpg`). Astro
  converts them to responsive AVIF/WebP with correct sizes. No manual resizing is needed, but keep originals
  under ~4000 px.
- **Alt text is required** (min. 8 characters) for every cover and gallery image. Describe what is visible.
- Images inside the MDX text:

  ```mdx
  import { Image } from 'astro:assets';
  import wiring from './wiring.jpg';

  <figure>
    <Image src={wiring} alt="Wiring of the motor shield" />
    <figcaption>Fig. 3 — Motor shield wiring</figcaption>
  </figure>
  ```

- **Portrait on the About page:** save it as `src/assets/portrait.jpg` and follow the comment at the top of
  `src/pages/[...lang]/about.astro`.

## How to add a 3D model

1. Export from CAD as **glTF binary (`.glb`)**. In SolidWorks use _File → Save As_ and pick the
   _Extended Reality / glTF binary (\*.glb)_ type. Other CAD tools: export STL/OBJ/STEP and convert to GLB with
   Blender (_File → Export → glTF 2.0_) or an online converter. Keep it under ~5 MB: drop small internal parts
   and simplify meshes. Check the result at <https://modelviewer.dev/editor/>.
2. Save it to `public/models/<name>.glb`.
3. Add to the project frontmatter:

   ```yaml
   model:
     src: /models/<name>.glb
     alt: What the model shows
     poster: ./model-poster.jpg # optional still image shown before loading
   ```

The viewer only downloads the model and the viewer library when a visitor clicks "Load 3D model", so it
never slows down the page. `public/models/delivery-robot.glb` is a generated **placeholder**. Replace it.

## Translations (EN/DE)

- UI texts (navigation, labels, buttons) are in `src/i18n/ui.ts`.
- To translate a project, add `de.mdx` next to `index.mdx` with `title`, `summary` (optionally `role` and
  `keyFigureLabels`) and the German body text. All specs, images and links come from the English file.
- Untranslated German project pages show the English text with a short notice, point their canonical URL to
  the English page, and are left out of the sitemap.
- About-page texts live directly in `src/pages/[...lang]/about.astro` (`copy.en` / `copy.de`).

## Other things to edit

| What                                | Where                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| Name, domain, links, status, e-mail | `src/data/site.ts` (domain also in `astro.config.ts`) |
| "Now" box                           | `src/data/now.ts`                                     |
| Colours, fonts, spacing             | `src/styles/global.css` (tokens at the top)           |
| Navigation entries                  | `src/components/Header.astro`                         |
| Open Graph images (link previews)   | generated automatically, layout in `src/lib/og.ts`    |
| Redirects, cache & security headers | `public/.htaccess` (Apache)                           |

## How to deploy

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) installs, lints and builds the site, then
uploads only the changed files to the web root (`/marioschoch.ch`) over FTPS (or SFTP) (about 2 minutes). Stale files from earlier deploys
are removed; nothing else on the server is touched.

- **First-time setup** (Plesk login, Let's Encrypt, GitHub Secrets, first deploy):
  **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**
- **Check a deploy:** GitHub → Actions → the latest "Deploy" run. It ends with a smoke test against the live
  site.
- **Roll back:** Actions → Deploy → _Run workflow_ → enter the SHA of the last good commit in "ref" (or
  `git revert` the bad commit and push). See DEPLOYMENT.md §7.
- Things you still need to provide: **[docs/CHECKLIST.md](docs/CHECKLIST.md)**.

## Implementation notes

- **Fonts:** IBM Plex Sans/Mono are self-hosted from `@fontsource` via Astro's Fonts API with the `local`
  provider (`src/lib/fontsource.ts`). Astro 7.4's `npm` font provider fails on `file://` URLs, which is why
  the variants are listed explicitly. Astro generates size-matched fallback fonts, so there is no layout shift.
- **Content Security Policy:** Astro inlines small scripts, so `scripts/csp-hashes.mjs` (run by
  `npm run build`) hashes every inline script and writes the hashes into `dist/.htaccess`. No
  `'unsafe-inline'` is needed for scripts.
- **Deploy script** (`scripts/deploy.mjs`): FTPS (explicit TLS, certificate always verified) or SFTP
  (server host key pinned via `DEPLOY_KNOWN_HOSTS`), chosen by `DEPLOY_PROTOCOL`. It keeps a
  `.deploy-manifest.json` (path → SHA-256) on the server, uploads only changed files, deletes only files it
  uploaded itself, and refuses any target folder other than the web root (`WEB_ROOT_NAMES`). On kreativmedia, port 22 (SSH)
  is currently firewalled, so FTPS via `venus.kreativmedia.ch` is used.
- **Page transitions** use native cross-document View Transitions (pure CSS, disabled under
  `prefers-reduced-motion`), not Astro's `<ClientRouter>`. No router JavaScript is needed, and every page
  stays a normal page load.
- **Reading time** is computed from the raw entry body (`src/lib/reading-time.ts`), because Astro 7's
  default Markdown engine no longer runs remark plugins.
- **ESLint** uses v10 with `eslint-plugin-astro`. `eslint-plugin-jsx-a11y` is not yet compatible with
  ESLint 10, so accessibility is covered by required alt texts in the schema, semantic markup and Lighthouse.
