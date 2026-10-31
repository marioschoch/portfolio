# marioschoch.ch — personal portfolio

Static portfolio site built with **Astro 7**, **TypeScript**, **Tailwind CSS 4** and **MDX**. It is hosted on
Plesk shared hosting at kreativmedia.ch (Apache, no Node.js on the server) and deployed automatically via
GitHub Actions and SFTP on every push to `main`.

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
│  └─ now.ts                  # "Now" section on the home page
├─ i18n/ui.ts                 # all UI strings in English + German
├─ pages/[...lang]/           # every page exists once and renders at /… and /de/…
├─ assets/fonts/              # Inter Tight (vendored subset, OFL), see "Design"
├─ styles/global.css          # all design tokens, the grid and the shared styles
├─ components/  layouts/  lib/
public/
├─ favicon.svg                # "MS" mark, see "Design"
├─ cv/*.pdf                   # CV PDFs written by `npm run cv:pdf`
├─ models/*.glb               # 3D models
└─ files/                     # other downloads (e.g. report PDFs)
design-refs/                  # content check for design changes (not part of the build)
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
summary: Optional one-line teaser for the home page (otherwise the first paragraph is used).
---

What happened, what you measured, what's next.
```

It appears in the project's log and on the home page (latest three).

## How to edit the CV

- **Web version:** edit `src/data/cv.ts`. Text fields are either a plain string or `{ en: '…', de: '…' }`.
  Projects are referenced by folder name, so titles and links stay in sync. Empty lists (e.g. `awards: []`)
  hide their section.
- **PDF:** after editing `cv.ts`, run **`npm run cv:pdf`** and commit the two PDFs it writes to `public/cv/`
  (`Mario-Schoch-CV.pdf` in English, `Mario-Schoch-Lebenslauf.pdf` in German; file names in `site.ts → cvPdf`).
  The script starts the dev server, prints the A4 layout `src/pages/[...lang]/cv/pdf.astro` with your installed
  Chrome (set `CHROME_PATH` if it isn't found) and warns if the CV no longer fits on one page. That layout exists
  only in the dev server (open `/cv/pdf/` there to preview it); the deployed site ships just the PDFs. Each
  language's `/cv` page shows its "Download PDF" button once that PDF exists.
- No address, phone number or date of birth, neither on the page nor in the PDF.

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

- **Portrait on the CV page:** save it as `src/assets/portrait.jpg`.

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
never slows down the page.

## Translations (EN/DE)

- UI texts (navigation, labels, buttons) are in `src/i18n/ui.ts`.
- To translate a project, add `de.mdx` next to `index.mdx` with `title`, `summary` (optionally `role` and
  `keyFigureLabels`) and the German body text. All specs, images and links come from the English file.
- Untranslated German project pages show the English text with a short notice, point their canonical URL to
  the English page, and are left out of the sitemap.

## Design

The site is set in the International Typographic Style (Swiss Style). Everything visual is defined in
`src/styles/global.css`, with the tokens at the top:

- **Colours:** paper `#f2f1ec`, ink `#111111`, a muted grey and one red accent (`#e8401f`). Dark mode
  redefines the same tokens (system preference or the theme toggle). Red appears about once per screen and is
  used for text only from 24 px up (contrast); body text and links stay ink.
- **Grid:** the `grid-page` utility gives 4 columns on phones and 12 from 768 px (`--cols`, `--margin`,
  `--gutter`). Children span the full width until they are placed, e.g. `md:col-span-9 md:col-start-4`.
  Meta (labels, dates, specs) sits in columns 1–3, content in 4–12.
- **Type:** Inter Tight in 400, 500 and 600. Sizes are `text-small`, `text-body` and `text-lead`, plus the
  utilities `heading`, `display-m` and `display` (page titles). Spacing uses an 8 px unit.
- **Section numbers** (01, 02 …) come from a CSS counter in the `section-title` utility, so they renumber
  themselves when a section is added or hidden, and screen readers skip them.
- **Hairlines, not boxes:** 1 px rules separate things. No rounded corners, shadows, gradients or decorative
  icons. Motion is limited to 150 ms colour and underline changes and is switched off under
  `prefers-reduced-motion`.
- **Favicon:** `public/favicon.svg` is "MS" in Inter Tight SemiBold, stored as outlines so it doesn't depend
  on installed fonts, with a red square. It inverts in dark mode.

### Checking that a design change kept the content

`design-refs/content-extract.mjs` takes a snapshot of every built page (visible text, links, images and alt
texts, labels, metadata) and diffs two snapshots. `design-refs/content-baseline.json` is the content before
the Swiss redesign.

```bash
npm run build
node design-refs/content-extract.mjs extract dist /tmp/content.json
node design-refs/content-extract.mjs diff design-refs/content-baseline.json /tmp/content.json
```

Against this baseline, the diff shows the redesign's approved decorative changes (the hidden repeats of the
name removed, row numbers 01/02 added) plus any content edited since. To take a new baseline, extract into
`design-refs/content-baseline.json` and run `npx prettier --write` on it (CI checks formatting).

## Other things to edit

| What                                | Where                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| Name, domain, links, status, e-mail | `src/data/site.ts` (domain also in `astro.config.ts`) |
| "Now" section                       | `src/data/now.ts`                                     |
| Colours, fonts, grid, spacing       | `src/styles/global.css` (tokens at the top)           |
| Navigation entries                  | `src/components/Header.astro`                         |
| Open Graph images (link previews)   | generated automatically, layout in `src/lib/og.ts`    |
| Favicon                             | `public/favicon.svg`                                  |
| Redirects, cache & security headers | `public/.htaccess` (Apache)                           |

## How to deploy

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) installs, lints and builds the site, then
uploads only the changed files to the web root (`/marioschoch.ch`) over SFTP (about 2 minutes). Stale files from earlier deploys
are removed; nothing else on the server is touched.

- **First-time setup** (Plesk login, Let's Encrypt, GitHub Secrets, first deploy):
  **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**
- **Check a deploy:** GitHub → Actions → the latest "Deploy" run. It ends with a smoke test against the live
  site.
- **Roll back:** Actions → Deploy → _Run workflow_ → enter the SHA of the last good commit in "ref" (or
  `git revert` the bad commit and push). See DEPLOYMENT.md §7.
- Things you still need to provide: **[docs/CHECKLIST.md](docs/CHECKLIST.md)**.

## Implementation notes

- **Fonts** are self-hosted through Astro's Fonts API with the `local` provider. Astro generates size-matched
  fallback fonts, so there is no layout shift.
  - **Inter Tight** (`src/assets/fonts/`, OFL) is a variable-weight subset (400–600, roman and italic) of the
    Google Fonts release. It holds Latin plus the arrows and symbols the texts use. A character outside the
    subset falls back to Arial; to add one, re-subset the variable font with fonttools
    (`fonttools varLib.instancer … wght=400:600`, then `pyftsubset … --flavor=woff2`). The two static
    `.woff` files are for the Open Graph images, because Satori can't read variable WOFF2.
  - **IBM Plex Mono** (code, NumTrip terminal) and **IBM Plex Sans** (only the dev-only CV PDF layout, so
    `npm run cv:pdf` output stays the same) come from `@fontsource` (`src/lib/fontsource.ts`). Astro 7.4's
    `npm` font provider fails on `file://` URLs, which is why their variants are listed explicitly.
- **Content Security Policy:** Astro inlines small scripts, so `scripts/csp-hashes.mjs` (run by
  `npm run build`) hashes every inline script and writes the hashes into `dist/.htaccess`. No
  `'unsafe-inline'` is needed for scripts.
- **Deploy script** (`scripts/deploy.mjs`): SFTP (server host key pinned via `DEPLOY_KNOWN_HOSTS`) or FTPS
  (explicit TLS, certificate always verified), chosen by `DEPLOY_PROTOCOL`. It keeps a
  `.deploy-manifest.json` (path → SHA-256) on the server, uploads only changed files, deletes only files it
  uploaded itself, and refuses any target folder other than the web root (`WEB_ROOT_NAMES`). On kreativmedia, SSH runs on
  port 2121 (port 22 is firewalled), so the deploy uses SFTP to `venus.kreativmedia.ch:2121` with an SSH key.
- **No page transitions or scroll animations:** every page is a normal page load, without Astro's
  `<ClientRouter>` or View Transitions. Prefetching on hover keeps navigation fast.
- **Code blocks** are monochrome: `global.css` overrides Shiki's theme colours with ink, comments in grey,
  so red stays the only accent.
- **Reading time** is computed from the raw entry body (`src/lib/reading-time.ts`), because Astro 7's
  default Markdown engine no longer runs remark plugins.
- **ESLint** uses v10 with `eslint-plugin-astro`. `eslint-plugin-jsx-a11y` is not yet compatible with
  ESLint 10, so accessibility is covered by required alt texts in the schema, semantic markup and Lighthouse.
