/**
 * Content access layer. Pages never call getCollection() directly — they use these
 * helpers, which handle sorting, translation fallback and derived values.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/utils';
import { readingMinutes } from './reading-time';

export type ProjectEntry = CollectionEntry<'projects'>;
export type UpdateEntry = CollectionEntry<'updates'>;

export interface LocalizedProject {
  id: string;
  /** English entry: specs, images and (fallback) body. */
  entry: ProjectEntry;
  /** German translation, when one exists for the requested language. */
  translation?: CollectionEntry<'projectsDe'>;
  /** True when the requested language has its own text. */
  translated: boolean;
  title: string;
  summary: string;
  role: string;
  keyFigures: ProjectEntry['data']['keyFigures'];
  minutesRead: number;
  lastUpdated: Date;
}

const byOrderThenDate = (a: ProjectEntry, b: ProjectEntry) =>
  a.data.order - b.data.order ||
  b.data.timeframe.start.getTime() - a.data.timeframe.start.getTime();

const byDateDesc = (a: UpdateEntry, b: UpdateEntry) =>
  b.data.date.getTime() - a.data.date.getTime();

/** All updates, newest first. */
export async function getUpdates(): Promise<UpdateEntry[]> {
  return (await getCollection('updates')).sort(byDateDesc);
}

/** Updates of one project, newest first. */
export async function getProjectUpdates(projectId: string): Promise<UpdateEntry[]> {
  return (await getUpdates()).filter((u) => u.data.project.id === projectId);
}

/** Merge an English project with its translation (if any) for the given language. */
export async function localizeProject(entry: ProjectEntry, lang: Lang): Promise<LocalizedProject> {
  // Looked up in the loaded collection (not getEntry) so missing translations don't log warnings.
  const translation =
    lang === 'de' ? (await getCollection('projectsDe')).find((t) => t.id === entry.id) : undefined;
  const updates = await getProjectUpdates(entry.id);
  const dates = [
    entry.data.updated,
    updates[0]?.data.date,
    entry.data.timeframe.end,
    entry.data.timeframe.start,
  ]
    .filter((d): d is Date => d instanceof Date)
    .map((d) => d.getTime());
  const body = translation?.body ?? entry.body;

  const keyFigures = entry.data.keyFigures.map((figure, i) => ({
    ...figure,
    label: translation?.data.keyFigureLabels?.[i] ?? figure.label,
  }));

  return {
    id: entry.id,
    entry,
    translation,
    translated: lang === 'en' || Boolean(translation),
    title: translation?.data.title ?? entry.data.title,
    summary: translation?.data.summary ?? entry.data.summary,
    role: translation?.data.role ?? entry.data.role,
    keyFigures,
    minutesRead: readingMinutes(body),
    lastUpdated: new Date(Math.max(...dates)),
  };
}

/** All projects for a language, in display order. */
export async function getProjects(lang: Lang): Promise<LocalizedProject[]> {
  const entries = (await getCollection('projects')).sort(byOrderThenDate);
  return Promise.all(entries.map((e) => localizeProject(e, lang)));
}

/** Up to `limit` featured projects (falls back to the first projects if too few are featured). */
export async function getFeaturedProjects(lang: Lang, limit = 3): Promise<LocalizedProject[]> {
  const all = await getProjects(lang);
  const featured = all.filter((p) => p.entry.data.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

/** Plain-text teaser for an update: explicit summary or the first paragraph of the body. */
export function updateTeaser(update: UpdateEntry, max = 220): string {
  if (update.data.summary) return update.data.summary;
  const firstParagraph =
    (update.body ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith('#') && !p.startsWith('import') && !p.startsWith('<')) ?? '';
  const plain = firstParagraph.replace(/[*_`#>[\]]|\(([^)]*)\)/g, '').replace(/\s+/g, ' ');
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
