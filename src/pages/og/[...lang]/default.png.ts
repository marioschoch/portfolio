/** Default Open Graph image for all non-project pages: /og/default.png, /og/de/default.png */
import type { APIRoute } from 'astro';
import { renderOg } from '@/lib/og';
import { site } from '@/data/site';
import { langPaths, useTranslations, type Lang } from '@/i18n/utils';

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const t = useTranslations(lang);
  const png = await renderOg({
    kicker: 'ETH Zürich · D-MAVT',
    title: site.name,
    subtitle: site.tagline[lang],
    specs: [
      [t('og.focus'), t('og.focusValue')],
      [t('spec.status'), t('og.statusValue')],
    ],
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
