/**
 * Reading time from the raw Markdown/MDX body of a content entry.
 * Strips code fences, MDX/JSX tags, imports and Markdown syntax before counting words.
 */
import getReadingTime from 'reading-time';

export function readingMinutes(body: string | undefined): number {
  if (!body) return 1;
  const text = body
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/^(import|export) .*$/gm, ' ') // MDX imports/exports
    .replace(/<[^>]+>/g, ' ') // JSX / HTML tags
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ') // MDX comments
    .replace(/[#>*_`[\]()!-]/g, ' ');
  return Math.max(1, Math.round(getReadingTime(text).minutes));
}
