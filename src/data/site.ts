/**
 * Global site configuration — the single place for personal details and links.
 * Header, footer, JSON-LD, CV and contact page all read from here.
 */

export const site = {
  name: 'Mario Schoch',
  // Canonical domain (no www) — used for canonical URLs, sitemap, RSS and OG images.
  // Keep in sync with `site` in astro.config.ts and the Sitemap line in public/robots.txt.
  url: 'https://marioschoch.ch',
  // One-line positioning, shown under the name on the home page and used as default meta description.
  tagline: {
    en: 'Mechanical engineering student at ETH Zürich.',
    de: 'Maschinenbaustudent an der ETH Zürich.',
  },
  status: {
    en: 'BSc Mechanical Engineering @ ETH Zürich',
    de: 'BSc Maschineningenieurwissenschaften @ ETH Zürich',
  },
  // TODO: earliest internship start, e.g. { en: 'February 2027', de: 'Februar 2027' } — null hides the line.
  availableFrom: null as { en: string; de: string } | null,
  location: 'Zürich, Switzerland',
  // E-mail split into parts so it never appears in plain text in the HTML (see ObfuscatedEmail.astro).
  // TODO: confirm this is the address you want to publish.
  email: { user: 'marioschoch05', domain: 'gmail.com' },
  links: {
    github: 'https://github.com/marioschoch',
    linkedin: 'https://www.linkedin.com/in/mario-schoch-56b851354/',
  },
  // Drop your CV PDF into public/cv/ with exactly this file name; the CV page detects it at build time.
  cvPdf: '/cv/Mario-Schoch-CV.pdf',
  // Cloudflare Web Analytics token (plain JS snippet, works on any host, no cookies, no DNS change).
  // Provided at build time via the PUBLIC_CF_ANALYTICS_TOKEN GitHub secret (see docs/DEPLOYMENT.md);
  // when empty (e.g. locally) no beacon is included.
  analyticsToken: (import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN as string | undefined) ?? '',
};
