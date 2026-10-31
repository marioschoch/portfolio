/**
 * Open Graph image renderer (1200×630 PNG), run at build time.
 * Satori turns a small element tree into SVG; resvg rasterises it to PNG.
 * Fonts are static Inter Tight instances in src/assets/fonts (Satori needs WOFF/TTF, not variable
 * WOFF2), so link previews are set like the site: ink on paper, hairlines, one red.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { site } from '@/data/site';

const font = (weight: number) =>
  readFileSync(join(process.cwd(), `src/assets/fonts/inter-tight-${weight}.woff`));

const fonts = [
  { name: 'Inter Tight', data: font(400), weight: 400 as const, style: 'normal' as const },
  { name: 'Inter Tight', data: font(500), weight: 500 as const, style: 'normal' as const },
];

/** The site's light tokens (src/styles/global.css). */
const C = {
  bg: '#f2f1ec',
  fg: '#111111',
  muted: '#5e5d58',
  accent: '#e8401f',
};

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
/** Minimal hyperscript helper so we don't need React/JSX for Satori. */
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children },
});

export interface OgInput {
  /** Small line at the top, e.g. "Project · 2025". */
  kicker: string;
  title: string;
  subtitle?: string;
  /** Spec-sheet rows in the footer, e.g. [["Role", "Firmware lead"], ["Tools", "Arduino · C++"]]. */
  specs?: [string, string][];
}

export async function renderOg({ kicker, title, subtitle, specs = [] }: OgInput): Promise<Buffer> {
  const host = new URL(site.url).host;
  const big = title.length <= 16;
  const titleSize = big ? 136 : 80;
  const tree = h(
    'div',
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: C.bg,
      padding: '48px 56px',
      boxSizing: 'border-box',
      fontFamily: 'Inter Tight',
      color: C.fg,
    },
    [
      // Two columns, like the site's label column and content column.
      h('div', { width: '100%', fontSize: 22, color: C.muted }, [
        h('div', { width: '50%' }, kicker),
        h('div', {}, host),
      ]),
      h(
        'div',
        { flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: '100%' },
        [
          h(
            'div',
            {
              fontSize: titleSize,
              fontWeight: 500,
              lineHeight: 0.92,
              letterSpacing: titleSize * -0.045,
            },
            title,
          ),
          subtitle
            ? h('div', { fontSize: 30, lineHeight: 1.25, marginTop: 24, maxWidth: 820 }, subtitle)
            : null,
        ].filter(Boolean),
      ),
      h(
        'div',
        {
          width: '100%',
          borderTop: `1px solid ${C.fg}`,
          paddingTop: 16,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        [
          h(
            'div',
            { gap: 32 },
            specs
              .slice(0, 3)
              .map(([k, v]) =>
                h('div', { flexDirection: 'column', gap: 4, width: 260 }, [
                  h('div', { fontSize: 18, color: C.muted }, k),
                  h('div', { fontSize: 22 }, v),
                ]),
              ),
          ),
          h('div', { fontSize: 28, fontWeight: 500, color: C.accent }, site.name),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
