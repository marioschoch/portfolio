/**
 * Content collections — the typed data model of the site.
 * The build FAILS if an entry is missing a required field or has a wrong value,
 * so broken or incomplete projects can never be deployed.
 *
 *   src/content/projects/<slug>/index.mdx   English project page (source of truth)
 *   src/content/projects/<slug>/de.mdx      optional German translation (text only)
 *   src/content/updates/<date>-<slug>.md    project log entry, linked to a project
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Allowed project tags — extend this list to add a new filter. */
export const projectTags = [
  'mechatronics',
  'embedded',
  'cad',
  'analysis',
  'web',
  'software',
  'bikes',
] as const;
export const projectStatuses = ['in-progress', 'completed'] as const;

/** Folder name = slug, e.g. `projects/delivery-robot/index.mdx` → `delivery-robot`. */
const slugFromFolder = ({ entry }: { entry: string }) => entry.split('/')[0]!;

/** Alt texts are mandatory and must be meaningful. */
const altText = z.string().min(8, 'Alt text must describe the image (min. 8 characters).');

const projects = defineCollection({
  loader: glob({
    pattern: '*/index.{md,mdx}',
    base: './src/content/projects',
    generateId: slugFromFolder,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(80),
      /** One or two sentences: used on cards, in meta descriptions and OG images. */
      summary: z.string().min(40).max(220),
      role: z.string(),
      timeframe: z.object({
        start: z.coerce.date(),
        /** Omit while the project is ongoing. */
        end: z.coerce.date().optional(),
      }),
      teamSize: z.number().int().positive(),
      tools: z.array(z.string()).min(1),
      tags: z.array(z.enum(projectTags)).min(1),
      status: z.enum(projectStatuses),
      /** Featured projects appear on the home page (the three most recent are shown). */
      featured: z.boolean().default(false),
      /** Lower numbers come first in lists; ties are broken by start date (newest first). */
      order: z.number().default(100),
      /** Optional for now (no photos yet) — a technical placeholder is rendered instead. */
      cover: z.object({ src: image(), alt: altText }).optional(),
      gallery: z
        .array(z.object({ src: image(), alt: altText, caption: z.string().optional() }))
        .default([]),
      /** GLB export in public/models/ for the interactive 3D viewer. */
      model: z
        .object({
          src: z.string().regex(/^\/models\/.+\.glb$/, 'Place GLB files in public/models/'),
          alt: altText,
          poster: image().optional(),
        })
        .optional(),
      links: z
        .object({
          github: z.url().optional(),
          report: z.string().optional(),
          video: z.url().optional(),
          website: z.url().optional(),
        })
        .default({}),
      /** Highlighted numbers shown in the key-figure strip. */
      keyFigures: z
        .array(z.object({ value: z.string(), unit: z.string().optional(), label: z.string() }))
        .max(4)
        .default([]),
      /** Manually bumped when the write-up changes; the latest update date also counts. */
      updated: z.coerce.date().optional(),
    }),
});

/** German translation of a project: only the texts, all specs come from the English entry. */
const projectsDe = defineCollection({
  loader: glob({
    pattern: '*/de.{md,mdx}',
    base: './src/content/projects',
    generateId: slugFromFolder,
  }),
  schema: z.object({
    title: z.string().max(80),
    summary: z.string().min(40).max(220),
    role: z.string().optional(),
    keyFigureLabels: z.array(z.string()).optional(),
  }),
});

const updates = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/updates' }),
  schema: z.object({
    title: z.string().max(100),
    date: z.coerce.date(),
    /** Must match a project folder name — the build fails on typos. */
    project: reference('projects'),
    /** Optional short teaser for the feed and RSS; falls back to the first paragraph. */
    summary: z.string().max(240).optional(),
  }),
});

export const collections = { projects, projectsDe, updates };
