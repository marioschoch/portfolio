// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { fontsourceVariants } from './src/lib/fontsource';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // TODO: set to the final domain (keep in sync with src/data/site.ts).
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
      options: { variants: fontsourceVariants('ibm-plex-sans', [400, 500, 600], ['normal', 'italic']) },
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
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en-GB', de: 'de-CH' } },
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
