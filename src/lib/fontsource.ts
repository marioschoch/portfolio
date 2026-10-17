/**
 * Builds local font variants from installed @fontsource packages.
 *
 * Why not `fontProviders.npm()`? In Astro 7.4 it resolves files as `file://` URLs,
 * which the font fetcher then tries to download with fetch() and fails. The `local`
 * provider reads plain paths, so we list the @fontsource files ourselves — fonts are
 * still self-hosted and fallbacks are still metric-optimised.
 */
import { readFileSync } from 'node:fs';

type Style = 'normal' | 'italic';

export function fontsourceVariants(
  pkg: string,
  weights: number[],
  styles: Style[] = ['normal'],
  subsets: string[] = ['latin', 'latin-ext'],
) {
  const dir = `./node_modules/@fontsource/${pkg}`;
  const variants = weights.flatMap((weight) =>
    styles.flatMap((style) =>
      subsets.map((subset) => {
        const suffix = style === 'italic' ? `${weight}-italic` : `${weight}`;
        const css = readFileSync(`${dir}/${subset}-${suffix}.css`, 'utf8');
        const range = /unicode-range:\s*([^;]+);/.exec(css)?.[1]?.trim();
        return {
          weight,
          style,
          src: [`${dir}/files/${pkg}-${subset}-${weight}-${style}.woff2`] as [string],
          ...(range ? { unicodeRange: [range] as [string] } : {}),
        };
      }),
    ),
  );
  if (!variants[0]) throw new Error(`No font variants for ${pkg}`);
  // Astro's type requires a non-empty tuple.
  return variants as [(typeof variants)[0], ...typeof variants];
}
