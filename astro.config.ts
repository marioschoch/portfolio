// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import type { AstroIntegration } from 'astro';
import { existsSync, readdirSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { fontsourceVariants } from './src/lib/fontsource';

/**
 * Lists projects without a German translation at the start of every build: their /de/ page
 * silently shows the English text, which is easy to miss otherwise.
 */
function missingTranslations(): AstroIntegration {
  const dir = './src/content/projects';
  return {
    name: 'missing-translations',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const missing = readdirSync(dir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .filter(
            (slug) => !existsSync(`${dir}/${slug}/de.mdx`) && !existsSync(`${dir}/${slug}/de.md`),
          );
        if (missing.length > 0) {
          logger.warn(`No German translation (de.mdx), /de/ shows English: ${missing.join(', ')}`);
        }
      },
    },
  };
}

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Canonical domain, no www (keep in sync with src/data/site.ts). Served from the root, so no `base`.
  site: 'https://marioschoch.ch',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Prefetch internal links on hover/focus for near-instant navigation.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  // Self-hosted fonts from the locally installed @fontsource packages (no network at build time).
  // Astro generates metric-matched fallback faces, which prevents layout shift while fonts load.
  fonts: [
    {
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      provider: fontProviders.local(),
      options: {
        variants: fontsourceVariants('ibm-plex-sans', [400, 500, 600], ['normal', 'italic']),
      },
      fallbacks: ['system-ui', 'sans-serif'],
      display: 'swap',
    },
    {
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      provider: fontProviders.local(),
      options: { variants: fontsourceVariants('ibm-plex-mono', [400, 500]) },
      fallbacks: ['ui-monospace', 'monospace'],
      display: 'swap',
    },
  ],

  integrations: [
    mdx(),
    missingTranslations(),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en-GB', de: 'de-CH' } },
      // German project pages without a de.mdx only show the English text (canonical → English),
      // so they are left out of the sitemap until a translation exists.
      filter: (page) => {
        const slug = /\/de\/projects\/([^/]+)\/$/.exec(page)?.[1];
        return !slug || existsSync(`./src/content/projects/${slug}/de.mdx`);
      },
    }),
  ],

  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },

  image: {
    // Responsive images get srcset/sizes automatically; layout reserves space (no CLS).
    layout: 'constrained',
    responsiveStyles: true,
  },

  vite: {
    plugins: [tailwindcss()],
    // <model-viewer> (~1 MB incl. three.js) is a lazily imported chunk, loaded only on demand.
    build: { chunkSizeWarningLimit: 1200 },
  },
});
