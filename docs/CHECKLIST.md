# What I still need to provide

Run `npm run todos` to list every placeholder in the code. Each item below says where it goes.

## Decisions

- [ ] **Domain**: register it, then update `src/data/site.ts → url`, `astro.config.ts → site`,
      `public/robots.txt`, and connect it (docs/DEPLOYMENT.md, step 4).
- [ ] **Internship availability**: `site.ts → availableFrom`, e.g. `{ en: 'February 2027', de: 'Februar 2027' }`.
- [ ] **Public e-mail**: confirm `site.ts → email` (currently your Gmail address).

## Files

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

## Texts (everything marked TODO)

- [ ] **Projects** (`src/content/projects/*/index.mdx`): role, dates, team size, tools, key figures and the
      problem → approach → result text. **All numbers are invented placeholders.**
- [ ] **Updates** (`src/content/updates/*.md`): replace the six example entries with real ones (or delete
      them).
- [ ] **CV** (`src/data/cv.ts`): school, start dates, work experience, skills, language levels, awards
- [ ] **About** (`src/pages/[...lang]/about.astro`): intro, story, what you're looking for, beyond engineering
- [ ] **Now** (`src/data/now.ts`): 2–4 current items
- [ ] **German translation** of the robot project (`delivery-robot/de.mdx`): review once the English text
      is final. Add `de.mdx` for other projects whenever you like.

## Links

- [ ] GitHub repository URLs for each project (currently your profile as a placeholder)
- [ ] VELOVE website URL (`velove-website/index.mdx → links.website`)
- [ ] LinkedIn: make sure your profile URL in `site.ts` is the public one you want to share

## Before sending applications

- [ ] `npm run todos` shows nothing in `src/`
- [ ] Check every page on your phone in light and dark mode
- [ ] Test the LinkedIn link preview (Post Inspector) for the home page and one project
