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
  readFileSync(join(process.cwd(), `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff`));

const fonts = [
  { name: 'Plex Sans', data: font('ibm-plex-sans', 400), weight: 400 as const, style: 'normal' as const },
  { name: 'Plex Sans', data: font('ibm-plex-sans', 600), weight: 600 as const, style: 'normal' as const },
  { name: 'Plex Mono', data: font('ibm-plex-mono', 400), weight: 400 as const, style: 'normal' as const },
];

const C = { bg: '#fafaf9', fg: '#15171b', muted: '#5d6370', rule: '#d5d7dc', accent: '#1d55c4', grid: '#ececea' };

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
/** Minimal hyperscript helper so we don't need React/JSX for Satori. */
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children },
});

export interface OgInput {
  /** Small mono label, e.g. "PROJECT · 2025". */
  kicker: string;
  title: string;
  subtitle?: string;
  /** Spec-sheet rows in the footer, e.g. [["ROLE", "Firmware lead"], ["TOOLS", "Arduino · C++"]]. */
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
      backgroundImage: `linear-gradient(to right, ${C.grid} 1px, transparent 1px), linear-gradient(to bottom, ${C.grid} 1px, transparent 1px)`,
      backgroundSize: '40px 40px',
      padding: '56px 72px',
      boxSizing: 'border-box',
      fontFamily: 'Plex Sans',
      color: C.fg,
    },
    [
      h('div', { width: '100%', justifyContent: 'space-between', fontFamily: 'Plex Mono', fontSize: 20, color: C.muted, letterSpacing: 2 }, [
        h('div', { alignItems: 'center', gap: 14 }, [
          h('div', { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent }),
          kicker.toUpperCase(),
        ]),
        host,
      ]),
      h('div', { flexDirection: 'column', flexGrow: 1, justifyContent: 'center', width: '100%' }, [
        h('div', { fontSize: title.length > 32 ? 60 : 72, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }, title),
        subtitle
          ? h('div', { fontSize: 28, lineHeight: 1.4, color: C.muted, marginTop: 20 }, subtitle)
          : null,
      ].filter(Boolean)),
      h(
        'div',
        { width: '100%', borderTop: `2px solid ${C.fg}`, paddingTop: 20, justifyContent: 'space-between', alignItems: 'flex-end' },
        [
          h('div', { gap: 40 }, specs.slice(0, 3).map(([k, v]) =>
            h('div', { flexDirection: 'column', gap: 6, maxWidth: 300 }, [
              h('div', { fontFamily: 'Plex Mono', fontSize: 16, color: C.muted, letterSpacing: 2 }, k),
              h('div', { fontSize: 22 }, v),
            ]),
          )),
          h('div', { fontSize: 26, fontWeight: 600 }, site.name),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
