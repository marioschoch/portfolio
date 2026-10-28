/**
 * Prints the downloadable CV PDFs (one per language) from src/data/cv.ts:
 *
 *   npm run cv:pdf
 *
 * Starts Astro's dev server (the only place the A4 layout src/pages/[...lang]/cv/pdf.astro exists),
 * opens each language in headless Chrome and saves it under public/ at the path the page names in
 * its `cv-pdf` meta tag (site.ts → cvPdf). Commit the PDFs afterwards; the CV page shows the
 * download button once its PDF exists.
 *
 * Needs Google Chrome or Chromium; set CHROME_PATH if it isn't found automatically.
 * Talks to Chrome over the DevTools protocol with Node's built-in WebSocket, so no extra packages.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dev } from 'astro';

const PAGES = ['/cv/pdf/', '/de/cv/pdf/'];

const chromePath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!chromePath) throw new Error('Chrome not found. Set CHROME_PATH to the Chrome executable.');

/** Starts headless Chrome and resolves with the WebSocket URL of its blank first tab. */
async function startChrome(profile) {
  const chrome = spawn(
    chromePath,
    [
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const browserUrl = await new Promise((resolve, reject) => {
    let log = '';
    chrome.stderr.on('data', (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) resolve(match[1]);
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited (${code}):\n${log}`)));
  });
  const targets = await (await fetch(`http://${new URL(browserUrl).host}/json/list`)).json();
  const tab = targets.find((t) => t.type === 'page');
  if (!tab) throw new Error('Chrome opened no tab.');
  return { chrome, tabUrl: tab.webSocketDebuggerUrl };
}

/** Minimal DevTools protocol client: `send` a command, or wait `once` for an event. */
function connect(url) {
  const ws = new WebSocket(url);
  let lastId = 0;
  const pending = new Map();
  const waiting = new Map();
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else {
      waiting.get(msg.method)?.(msg.params);
      waiting.delete(msg.method);
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener('error', () => reject(new Error(`Cannot connect to ${url}`)));
    ws.addEventListener('open', () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const id = ++lastId;
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        once: (method) => new Promise((res) => waiting.set(method, res)),
        close: () => ws.close(),
      }),
    );
  });
}

// Runs inside the page once it has loaded: waits for the web fonts, then reports where the PDF
// goes and whether the content still fits on one A4 page (297 mm = 1123 CSS px).
const inspect = `document.fonts.ready.then(() => ({
  file: document.querySelector('meta[name="cv-pdf"]')?.content,
  overflow: document.documentElement.scrollHeight - 1123,
}))`;

const server = await dev({ root: '.', logLevel: 'error', devToolbar: { enabled: false } });
const profile = mkdtempSync(join(tmpdir(), 'cv-pdf-'));
let chrome;
try {
  const started = await startChrome(profile);
  chrome = started.chrome;
  const tab = await connect(started.tabUrl);
  await tab.send('Page.enable');

  for (const path of PAGES) {
    const url = `http://localhost:${server.address.port}${path}`;
    const loaded = tab.once('Page.loadEventFired');
    await tab.send('Page.navigate', { url });
    await loaded;
    const { result } = await tab.send('Runtime.evaluate', {
      expression: inspect,
      awaitPromise: true,
      returnByValue: true,
    });
    const { file, overflow } = result.value;
    if (!file) throw new Error(`${url} did not render the CV (no cv-pdf meta tag).`);
    if (overflow > 1) {
      console.warn(`[cv-pdf] ${path} is ${overflow}px longer than one A4 page: shorten the CV.`);
    }

    const { data } = await tab.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      generateTaggedPDF: true,
    });
    const out = join('public', file);
    mkdirSync(dirname(out), { recursive: true });
    const pdf = Buffer.from(data, 'base64');
    writeFileSync(out, pdf);
    console.log(`[cv-pdf] ${out} (${Math.round(pdf.length / 1000)} kB)`);
  }
  tab.close();
} finally {
  // Wait for Chrome to exit, or it may still be writing to the profile folder while it is removed.
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
  }
  await server.stop();
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
