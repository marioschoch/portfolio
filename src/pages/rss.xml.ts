/** RSS feed of all project updates (English). */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getProjects, getUpdates, updateTeaser } from '@/lib/content';
import { site } from '@/data/site';

export async function GET(context: APIContext) {
  const updates = await getUpdates();
  const titles = Object.fromEntries((await getProjects('en')).map((p) => [p.id, p.title]));

  return rss({
    title: `${site.name} — Project updates`,
    description: 'Progress notes from my engineering and software projects.',
    site: context.site ?? site.url,
    customData: '<language>en</language>',
    // Links below already end in a slash (or an #anchor); don't let the library append another.
    trailingSlash: false,
    items: updates.map((u) => ({
      title: `${titles[u.data.project.id]}: ${u.data.title}`,
      pubDate: u.data.date,
      description: updateTeaser(u, 400),
      link: `/projects/${u.data.project.id}/#${u.id}`,
      categories: [titles[u.data.project.id] ?? u.data.project.id],
    })),
  });
}
