/** Per-project Open Graph image: /og/projects/<slug>.png, /og/de/projects/<slug>.png */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderOg } from '@/lib/og';
import { localizeProject } from '@/lib/content';
import { langPaths, useTranslations, type Lang } from '@/i18n/utils';

/** Cut at a word boundary so the subtitle fits on two lines. */
const shorten = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/[\s,:;.–-]+\S*$/, '')}…`;

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection('projects');
  return langPaths().flatMap(({ params, props }) =>
    entries.map((entry) => ({
      params: { ...params, slug: entry.id },
      props: { ...props, entry },
    })),
  );
};

export const GET: APIRoute = async ({ props }) => {
  const { entry, lang } = props as { entry: CollectionEntry<'projects'>; lang: Lang };
  const t = useTranslations(lang);
  const project = await localizeProject(entry, lang);
  const { data } = entry;
  const year = data.timeframe.start.getUTCFullYear();
  const png = await renderOg({
    kicker: `${t('og.project')} · ${year} · ${t(`status.${data.status}`)}`,
    title: project.title,
    subtitle: shorten(project.summary, 120),
    specs: [
      [t('spec.role'), project.role],
      [
        t('spec.team'),
        data.teamSize === 1 ? t('spec.teamSolo') : `${data.teamSize} ${t('spec.teamPeople')}`,
      ],
      [t('spec.tools'), project.tools.slice(0, 3).join(' · ')],
    ],
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
