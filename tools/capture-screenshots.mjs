// Capture the PJOS website in desktop and mobile viewports, dark and light.
//
//   CHROME_BIN=/usr/bin/google-chrome node tools/capture-screenshots.mjs \
//     http://127.0.0.1:8098 docs/screenshots
//
// Dependency-free: launches headless Chrome and drives it over the DevTools
// protocol. Asserts HTTP 200, no horizontal overflow, dark/light actually
// applied, and unique hashes; writes manifest.json with the run timestamp.
import {spawn} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const URL_ = process.argv[2] ?? 'http://127.0.0.1:8098';
const OUT = path.resolve(process.argv[3] ?? 'docs/screenshots');
const CHROME = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
const PORT = Number(process.env.CDP_PORT ?? 9346);

mkdirSync(OUT, {recursive: true});
const profile = mkdtempSync(path.join(tmpdir(), 'pjos-site-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900',
  'about:blank',
], {stdio: 'ignore'});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(pathname) {
  const response = await fetch(`http://127.0.0.1:${PORT}${pathname}`);
  if (!response.ok) throw new Error(`${pathname} -> ${response.status}`);
  return response.json();
}

async function waitForCDP() {
  for (let i = 0; i < 100; i++) {
    try { return await fetchJSON('/json/list'); } catch { await sleep(100); }
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const {resolve, reject} = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      }
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    return new CDP(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
  }
}

let cdp;
const seen = new Map();
const manifest = [];
const results = [];

async function evaluate(expression) {
  const {result, exceptionDetails} = await cdp.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate failed');
  return result.value;
}

async function capture(name, width, height, light) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 600});
  await cdp.send('Page.navigate', {url: URL_});
  await sleep(900);
  const state = await evaluate(`(() => {
    const body = document.body;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      light: body.classList.contains('light'),
      title: document.title,
      text: body.innerText.trim().length,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    };
  })()`);
  if (state.overflow > 1) throw new Error(`${name}: horizontal overflow ${state.overflow}px`);
  if (state.text < 200) throw new Error(`${name}: page rendered too little text (${state.text})`);
  if (!state.h1) throw new Error(`${name}: no hero heading rendered`);
  if (light && !state.light) {
    await evaluate(`document.getElementById('theme').click()`);
    await sleep(300);
  }
  if (!light && state.light) {
    await evaluate(`document.getElementById('theme').click()`);
    await sleep(300);
  }
  const applied = await evaluate(`document.body.classList.contains('light')`);
  if (applied !== light) throw new Error(`${name}: theme did not apply (light=${applied})`);
  const shot = await cdp.send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  const bytes = Buffer.from(shot.data, 'base64');
  const file = path.join(OUT, `${name}.png`);
  writeFileSync(file, bytes);
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
  if (w !== width || h !== height) throw new Error(`${name}: PNG ${w}x${h}, expected ${width}x${height}`);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (seen.has(sha)) throw new Error(`${name}: duplicate of ${seen.get(sha)}`);
  seen.set(sha, name);
  manifest.push({name: `${name}.png`, width: w, height: h, theme: light ? 'light' : 'dark', title: state.title, sha256: sha});
  results.push(`${name}: ${w}x${h} ${light ? 'light' : 'dark'} “${state.h1}”`);
}

try {
  const targets = await waitForCDP();
  const page = targets.find((target) => target.type === 'page');
  cdp = await CDP.connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await capture('desktop-dark', 1440, 900, false);
  await capture('desktop-light', 1440, 900, true);
  await capture('mobile-390-dark', 390, 844, false);
  await capture('mobile-390-light', 390, 844, true);
} finally {
  cdp?.ws?.close();
  chrome.kill('SIGTERM');
  await sleep(300);
}

writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify({captured_at: new Date().toISOString(), url: URL_, chrome: CHROME, screenshots: manifest}, null, 2)}\n`);
console.log(results.join('\n'));
console.log(`captured ${manifest.length} screenshots, ${seen.size} unique hashes`);
