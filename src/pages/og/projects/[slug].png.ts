/** Per-project Open Graph image: /og/projects/<slug>.png */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderOg } from '@/lib/og';

/** Cut at a word boundary so the subtitle fits on two lines. */
const shorten = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/[\s,:;.–-]+\S*$/, '')}…`;

export const getStaticPaths: GetStaticPaths = async () =>
  (await getCollection('projects')).map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));

export const GET: APIRoute = async ({ props }) => {
  const { data } = (props as { entry: CollectionEntry<'projects'> }).entry;
  const year = data.timeframe.start.getUTCFullYear();
  const png = await renderOg({
    kicker: `Project · ${year} · ${data.status === 'completed' ? 'Completed' : 'In progress'}`,
    title: data.title,
    subtitle: shorten(data.summary, 120),
    specs: [
      ['Role', data.role],
      ['Team', data.teamSize === 1 ? 'Individual' : `${data.teamSize} people`],
      ['Tools', data.tools.slice(0, 3).join(' · ')],
    ],
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
