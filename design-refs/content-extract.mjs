/**
 * Content snapshot of the built site, used to prove that a redesign changed no content.
 * Not part of the build or deploy.
 *
 *   node design-refs/content-extract.mjs extract [dist] [out.json]   (defaults: dist, design-refs/content-current.json)
 *   node design-refs/content-extract.mjs diff <baseline.json> <current.json>
 *
 * Per page it records, in document order:
 *   head   title, meta description, canonical/alternate URLs, Open Graph values
 *   text   visible text outside <script>/<style>, one entry per block element (inline elements are
 *          joined as written, so spacing between them counts), whitespace collapsed;
 *          aria-hidden text separately
 *   links  every href (a, area, link rel=canonical/alternate)
 *   media  every img/source/canvas/iframe/object: image sources (see below) and alt text
 *   labels accessible names and form text: aria-label, title, placeholder, value, alt
 *   data   JSON data blocks (<script type="application/json"/"ld+json">) and content-carrying data-* attributes
 *   assets scripts, stylesheets and fonts (informational, they change with any CSS/JS edit)
 *
 * Image URLs from Astro's pipeline (/_astro/name.SOURCEHASH_TRANSFORMHASH.ext) are reduced to
 * name.SOURCEHASH: the source file stays the same even when sizes/formats of its derivatives change.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, ELEMENT_NODE, TEXT_NODE } from 'ultrahtml';

const SKIP = new Set(['script', 'style', 'template']);
/** Elements that start a new line of text. Text inside one block is joined exactly as written, so
 * a space that appears or disappears between inline elements («Strom», vs «Strom» ,) is a change. */
const BLOCK = new Set(
  'address article aside blockquote br button canvas dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr img input li main nav ol option p pre section select summary table td textarea th tr ul video'.split(
    ' ',
  ),
);
const BREAK = '\u0000';
const LABEL_ATTRS = ['aria-label', 'title', 'placeholder', 'value', 'aria-description'];
/** data-* attributes that only wire up behaviour or styling, not content. */
const BEHAVIOUR_DATA = /^data-(astro-|reveal$|work-|active$|theme$|language$)/;

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
const squash = (s) => decode(s).replace(/\s+/g, ' ').trim();

/** /_astro/cover.B0nq2H7Z_10WrJ0.webp → /_astro/cover.B0nq2H7Z (source image identity). */
function normaliseUrl(url) {
  const m =
    /^\/_astro\/([^/]+?)\.([A-Za-z0-9_-]{8})_[A-Za-z0-9_-]+\.(?:webp|avif|jpe?g|png|gif)$/.exec(
      url,
    );
  return m ? `/_astro/${m[1]}.${m[2]}` : url;
}
const srcsetUrls = (v) =>
  v
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);

function* htmlFiles(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith('.html')) yield path;
  }
}

function extractPage(html) {
  const page = {
    head: [],
    text: [],
    hiddenText: [],
    links: [],
    media: [],
    labels: [],
    data: [],
    assets: [],
  };
  /** Visible text as written, with a BREAK wherever a block element starts or ends. */
  const flow = [];
  const walk = (node, ctx) => {
    if (node.type === TEXT_NODE) {
      if (ctx.skip) return;
      if (ctx.hidden) {
        const text = squash(node.value);
        if (text) page.hiddenText.push(text);
      } else flow.push(decode(node.value));
      return;
    }
    if (node.type !== ELEMENT_NODE) {
      node.children?.forEach((child) => walk(child, ctx));
      return;
    }
    const name = node.name.toLowerCase();
    const a = Object.fromEntries(
      Object.entries(node.attributes ?? {}).map(([k, v]) => [k.toLowerCase(), decode(String(v))]),
    );
    const next = {
      skip: ctx.skip || SKIP.has(name) || ctx.head,
      hidden: ctx.hidden || a['aria-hidden'] === 'true',
      head: ctx.head || name === 'head',
    };

    // Head metadata.
    if (name === 'title' && ctx.head)
      page.head.push(`title: ${squash(node.children?.map((c) => c.value ?? '').join('') ?? '')}`);
    if (
      name === 'meta' &&
      a.content &&
      (a.name || a.property) &&
      !/^(generator|theme-color|viewport)$/.test(a.name ?? '')
    ) {
      page.head.push(`${a.name ?? a.property}: ${normaliseUrl(a.content)}`);
    }
    if (name === 'link' && a.href) {
      const rel = a.rel ?? '';
      if (/canonical|alternate|icon|sitemap/.test(rel))
        page.head.push(`link ${rel}${a.hreflang ? ` ${a.hreflang}` : ''}: ${a.href}`);
      else page.assets.push(`link ${rel}: ${a.href.replace(/\.[A-Za-z0-9_-]{8}\./, '.')}`);
    }

    // Scripts: JSON data blocks are content; executable scripts are assets.
    if (name === 'script') {
      const body = node.children?.map((c) => c.value ?? '').join('') ?? '';
      if (/json/.test(a.type ?? '')) page.data.push(`${a.type}: ${body.trim()}`);
      else
        page.assets.push(
          a.src ? `script src: ${a.src.replace(/\.[A-Za-z0-9_-]{8}\./, '.')}` : 'script inline',
        );
    }

    // Links and media.
    if (!next.head) {
      if (a.href && (name === 'a' || name === 'area')) page.links.push(a.href);
      if (
        [
          'img',
          'source',
          'video',
          'audio',
          'iframe',
          'embed',
          'object',
          'canvas',
          'track',
        ].includes(name)
      ) {
        const sources = [a.src, a.data, a.poster, ...(a.srcset ? srcsetUrls(a.srcset) : [])]
          .filter(Boolean)
          .map(normaliseUrl);
        page.media.push(
          [name, [...new Set(sources)].join(' '), a.alt !== undefined ? `alt="${a.alt}"` : '']
            .filter(Boolean)
            .join(' | '),
        );
      }
      for (const key of LABEL_ATTRS) {
        if (a[key] && !(key === 'value' && name === 'button'))
          page.labels.push(`${name}[${key}]: ${squash(a[key])}`);
      }
      for (const [key, value] of Object.entries(a)) {
        if (key.startsWith('data-') && value && !BEHAVIOUR_DATA.test(key)) {
          page.data.push(`${name}[${key}]: ${normaliseUrl(value)}`);
        }
      }
    }
    const block = BLOCK.has(name);
    if (block) flow.push(BREAK);
    node.children?.forEach((child) => walk(child, next));
    if (block) flow.push(BREAK);
  };
  walk(parse(html), { skip: false, hidden: false, head: false });
  page.text = flow
    .join('')
    .split(BREAK)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // The footer's "Build <date>" changes with every build day; it is not content.
  page.text = page.text.map((s) => s.replace(/^Build \d{4}-\d{2}-\d{2}\b/, 'Build <build date>'));
  return page;
}

function extract(dist = 'dist', out = 'design-refs/content-current.json') {
  const pages = {};
  for (const file of htmlFiles(dist)) {
    const route =
      '/' +
      relative(dist, file)
        .replace(/index\.html$/, '')
        .replace(/\\/g, '/');
    pages[route] = extractPage(readFileSync(file, 'utf8'));
  }
  writeFileSync(
    out,
    JSON.stringify({ generated: new Date().toISOString(), pages }, null, 2) + '\n',
  );
  const words = Object.values(pages).reduce((n, p) => n + p.text.join(' ').split(' ').length, 0);
  console.log(`${Object.keys(pages).length} pages, ${words} words of text → ${out}`);
}

/** Myers diff of two string arrays → edit script of [' ' | '-' | '+', item]. */
function editScript(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = new Int32Array(2 * max + 2);
  const trace = [];
  let x = 0;
  let y = 0;
  outer: for (let d = 0; d <= max; d++) {
    if (d > 5000) throw new Error('More than 5000 differences, giving up');
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      x =
        k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])
          ? v[max + k + 1]
          : v[max + k - 1] + 1;
      y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[max + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }
  const ops = [];
  for (let d = trace.length - 1; d > 0; d--) {
    const prev = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && prev[max + k - 1] < prev[max + k + 1]) ? k + 1 : k - 1;
    const prevX = prev[max + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) ops.push([' ', a[--x], --y]);
    if (prevK === k + 1) ops.push(['+', b[--y]]);
    else ops.push(['-', a[--x]]);
  }
  while (x > 0) ops.push([' ', a[--x], --y]);
  return ops.reverse();
}

/** Changed runs with up to 6 unchanged items of context on each side. */
function diffLines(a, b) {
  const ops = editScript(a, b);
  const out = [];
  ops.forEach(([op], i) => {
    if (op === ' ') return;
    if (i > 0 && ops[i - 1][0] !== ' ') return; // only the start of a run
    let end = i;
    while (end < ops.length && ops[end][0] !== ' ') end++;
    const before = ops
      .slice(Math.max(0, i - 6), i)
      .map((o) => o[1])
      .join(' ');
    const after = ops
      .slice(end, end + 6)
      .map((o) => o[1])
      .join(' ');
    const removed = ops
      .slice(i, end)
      .filter((o) => o[0] === '-')
      .map((o) => o[1])
      .join(' ');
    const added = ops
      .slice(i, end)
      .filter((o) => o[0] === '+')
      .map((o) => o[1])
      .join(' ');
    out.push(
      `… ${before} [${removed ? `-«${removed}»` : ''}${removed && added ? ' ' : ''}${added ? `+«${added}»` : ''}] ${after} …`,
    );
  });
  return out;
}

function diff(baseFile, currentFile) {
  const base = JSON.parse(readFileSync(baseFile, 'utf8')).pages;
  const current = JSON.parse(readFileSync(currentFile, 'utf8')).pages;
  // Text is compared word by word, so wrapping part of a sentence in a new element is not a change.
  const words = (p) => p.text.join(' ').split(' ');
  const hiddenWords = (p) => p.hiddenText.join(' ').split(' ').filter(Boolean);
  const strict = {
    text: words,
    hiddenText: hiddenWords,
    head: (p) => p.head,
    links: (p) => p.links,
    media: (p) => p.media,
    labels: (p) => p.labels,
    data: (p) => p.data,
  };
  let changes = 0;
  for (const route of new Set([...Object.keys(base), ...Object.keys(current)])) {
    if (!base[route] || !current[route]) {
      console.log(`\n${route}: ${base[route] ? 'REMOVED' : 'ADDED'} page`);
      changes++;
      continue;
    }
    for (const [key, get] of Object.entries(strict)) {
      const lines = diffLines(get(base[route]), get(current[route]));
      if (!lines.length) continue;
      changes += lines.length;
      console.log(`\n${route} · ${key}`);
      lines.forEach((l) => console.log(`  ${l}`));
    }
  }
  console.log(changes ? `\n${changes} changed line(s).` : 'No content differences.');
  process.exitCode = changes ? 1 : 0;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'extract') extract(...args);
else if (mode === 'diff') diff(...args);
else
  console.error(
    'Usage: content-extract.mjs extract [dist] [out.json] | diff <baseline.json> <current.json>',
  );
