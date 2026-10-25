/**
 * i18n helpers.
 *
 * Routing: English lives at the root (`/projects/`), German under `/de/` (`/de/projects/`).
 * Every page is a single `src/pages/[...lang]/…` file whose `getStaticPaths` emits both
 * variants via `langPaths()`, so page code is never duplicated per language.
 *
 * Where a text lives (never as a `lang === 'de' ? … : …` in a page):
 * - interface strings (labels, buttons, alt texts used site-wide) → `ui.ts`, via `useTranslations`
 * - data (site, CV, Now) → `{ en, de }` objects in `src/data/`, via `tx`; a plain string means
 *   the same text in both languages
 * - long texts of one page → a `copy = { en, de }[lang]` object at the top of that page
 * - project texts → `src/content/projects/<slug>/de.mdx` next to the English `index.mdx`;
 *   a missing one is reported at build time (see astro.config.ts)
 */
import { defaultLang, languages, ui, type Lang, type UiKey } from './ui';

export type { Lang, UiKey };
export { defaultLang, languages };

export const langs = Object.keys(languages) as Lang[];

/** Static paths for the `[...lang]` rest parameter: `undefined` renders at the root (English). */
export function langPaths() {
  return langs.map((lang) => ({
    params: { lang: lang === defaultLang ? undefined : lang },
    props: { lang },
  }));
}

/** Translate a UI key (every language has every key, enforced by the type of `ui`). */
export function useTranslations(lang: Lang) {
  return (key: UiKey): string => ui[lang][key];
}

/**
 * Prefix an internal path with the language segment and normalise the trailing slash.
 * `localizePath('/projects', 'de')` → `/de/projects/`
 */
export function localizePath(path: string, lang: Lang): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const prefix = lang === defaultLang ? '' : `/${lang}`;
  return clean ? `${prefix}/${clean}/` : `${prefix}/`;
}

/** Open Graph image of a page: `ogImagePath('projects/x', 'de')` → `/og/de/projects/x.png` */
export function ogImagePath(name: string, lang: Lang): string {
  return `/og${lang === defaultLang ? '' : `/${lang}`}/${name}.png`;
}

/** Strip the language prefix from a pathname: `/de/projects/x/` → `/projects/x/`. */
export function stripLang(pathname: string): string {
  for (const lang of langs) {
    if (lang === defaultLang) continue;
    if (pathname === `/${lang}` || pathname.startsWith(`/${lang}/`)) {
      return pathname.slice(lang.length + 1) || '/';
    }
  }
  return pathname;
}

/** Language of a pathname (used by the 404 page and the language switcher). */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split('/')[1];
  return first && first in languages ? (first as Lang) : defaultLang;
}

/** BCP-47 locales for the `lang` attribute, dates and Open Graph. */
export const locales: Record<Lang, string> = { en: 'en-GB', de: 'de-CH' };
export const ogLocales: Record<Lang, string> = { en: 'en_GB', de: 'de_CH' };

/** "12 Mar 2026" / "12. März 2026" */
export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locales[lang], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** "Mar 2026" / "März 2026" */
export function formatMonth(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locales[lang], {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** ISO date (YYYY-MM-DD) for `<time datetime>`. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
