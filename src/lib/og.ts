/**
 * Open Graph image renderer (1200×630 PNG), run at build time.
 * Satori turns a small element tree into SVG; resvg rasterises it to PNG.
 * Fonts are read from the locally installed @fontsource packages (Satori needs WOFF/TTF).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { site } from '@/data/site';

const font = (pkg: string, weight: number) =>
  readFileSync(
    join(process.cwd(), `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff`),
  );

const fonts = [
  {
    name: 'Plex Sans',
    data: font('ibm-plex-sans', 400),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'Plex Sans',
    data: font('ibm-plex-sans', 600),
    weight: 600 as const,
    style: 'normal' as const,
  },
];

/** The site's footer colours: grey type on the oxblood field. */
const C = {
  bg: '#7d0c14',
  fg: '#e2e2e2',
  muted: '#d9b3b6',
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
  const tree = h(
    'div',
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: C.bg,
      padding: '56px 72px',
      boxSizing: 'border-box',
      fontFamily: 'Plex Sans',
      color: C.fg,
    },
    [
      h(
        'div',
        {
          width: '100%',
          justifyContent: 'space-between',
          fontSize: 24,
          color: C.muted,
        },
        [h('div', {}, kicker), h('div', {}, host)],
      ),
      h(
        'div',
        { flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: '100%' },
        [
          h(
            'div',
            {
              fontSize: title.length > 32 ? 72 : 96,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: title.length > 32 ? -2.5 : -4,
            },
            title,
          ),
          subtitle
            ? h('div', { fontSize: 28, lineHeight: 1.4, color: C.muted, marginTop: 20 }, subtitle)
            : null,
        ].filter(Boolean),
      ),
      h(
        'div',
        {
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        },
        [
          h(
            'div',
            { gap: 40 },
            specs
              .slice(0, 3)
              .map(([k, v]) =>
                h('div', { flexDirection: 'column', gap: 6, maxWidth: 300 }, [
                  h('div', { fontSize: 18, color: C.muted }, k),
                  h('div', { fontSize: 22 }, v),
                ]),
              ),
          ),
          h('div', { fontSize: 26, fontWeight: 600 }, site.name),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
