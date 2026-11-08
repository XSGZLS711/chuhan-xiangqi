// npm run test:offline  (builds, then: node tests/offline.test.mjs)
// The installable app and its service worker (web/sw.js), in Chromium against the production
// build (`vite preview`). Online it opens /ai/ once, then a friend room and the lobby; then
// the server stops and the browser goes offline, and /ai/ must still load cross-origin
// isolated with a working engine, the lobby must open, and the friend room must say it
// cannot connect rather than show the game it saw. No /api/ response may ever be saved.
// Last, the off switch as a browser that has the worker meets it: once /sw.js is the
// switched-off version, the next page load must remove the worker and its saved files. Only
// dist/client/sw.js is changed for that (the pages of a real off build also stop
// registering it), and it is put back afterwards.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const SW_FILE = 'dist/client/sw.js';
const ENGINE = [
  '/ai/engine-host.js',
  '/ai/engine/stockfish.js',
  '/ai/engine/stockfish.wasm',
  '/ai/engine/stockfish.worker.js',
];
const failures = [];
let passed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(`${name}${detail ? `：${detail}` : ''}`);
  console.log(
    `${ok ? '✓' : '✗'} ${name}${!ok && detail ? `（${detail}）` : ''}`,
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}
/** The production build on this machine, on `port` (the same port keeps the same origin, and
 * with it the service worker, across restarts). Placeholder Google values in this process's
 * environment let the server start a sign-in, as in tests/layout.test.mjs; they are written
 * nowhere, and Google itself is never reached. */
async function startPreview(port) {
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(port), '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: {
        ...process.env,
        CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'offline-check',
        GOOGLE_CLIENT_SECRET:
          process.env.GOOGLE_CLIENT_SECRET || 'offline-check',
      },
    },
  );
  let log = '';
  server.stdout.on('data', (chunk) => (log += chunk));
  server.stderr.on('data', (chunk) => (log += chunk));
  const base = `http://localhost:${port}`;
  const stop = async () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {}
    for (let tries = 0; tries < 40; tries++) {
      try {
        await fetch(`${base}/api/me`);
      } catch {
        return;
      }
      await sleep(250);
    }
  };
  for (let tries = 0; tries < 240; tries++) {
    if (server.exitCode !== null) break;
    try {
      if ((await fetch(`${base}/api/me`)).ok) return { base, stop };
    } catch {}
    await sleep(250);
  }
  await stop();
  throw new Error(`vite preview 没有启动：\n${log}`);
}

/** A player talking to the room API directly, as tests/online.test.mjs does. */
function player(base) {
  let cookie = '';
  return async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        Origin: base,
        'Sec-Fetch-Site': 'same-origin',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      if (pair.startsWith('chuhan_session=') && !cookie) cookie = pair;
    }
    const text = await response.text();
    if (!response.ok)
      throw new Error(`${method} ${path} → ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

/** Runs in the page: every saved request, by cache, with the isolation headers it carries. */
function savedFiles() {
  return (async () => {
    const all = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      all[name] = [];
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        all[name].push({
          path: new URL(request.url).pathname + new URL(request.url).search,
          coop: response.headers.get('cross-origin-opener-policy'),
          coep: response.headers.get('cross-origin-embedder-policy'),
        });
      }
    }
    return all;
  })();
}

/** Runs in the page: starts the engine the way lib/ai-engine.ts does and searches once. */
function engineSearch() {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/ai/engine-host.js');
    const timer = setTimeout(() => reject(new Error('引擎超时')), 30000);
    const done = (fn, value) => {
      clearTimeout(timer);
      worker.terminate();
      fn(value);
    };
    worker.onerror = (event) => done(reject, new Error(event.message));
    worker.onmessage = ({ data }) => {
      if (data.type === 'error') done(reject, new Error(data.message));
      if (data.type === 'loaded') worker.postMessage('uci');
      if (data.type !== 'line') return;
      if (data.line === 'uciok')
        [
          'setoption name UCI_Variant value xiangqi',
          'setoption name Use NNUE value false',
          'position startpos',
          'go depth 6',
        ].forEach((command) => worker.postMessage(command));
      if (data.line.startsWith('bestmove')) done(resolve, data.line);
    };
  });
}

/** What keeps Chrome from offering to install the open page (empty: it can be installed). */
async function installErrors(context, page) {
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send(
    'Page.getInstallabilityErrors',
  );
  await cdp.detach();
  return installabilityErrors.map((error) => error.errorId);
}

const apiSaved = (files) =>
  Object.values(files)
    .flat()
    .filter((file) => file.path.startsWith('/api/'))
    .map((file) => file.path);

const original = await readFile(SW_FILE, 'utf8');
const port = await freePort();
let preview = await startPreview(port);
const { base } = preview;
const browser = await chromium.launch();
try {
  // ── The manifest and its icons ──
  const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
  const manifest = await manifestResponse.json();
  check(
    'manifest 可读，类型是 application/manifest+json',
    manifestResponse.ok &&
      manifestResponse.headers
        .get('content-type')
        ?.startsWith('application/manifest+json'),
    manifestResponse.headers.get('content-type') ?? '',
  );
  check(
    'manifest 满足安装条件（名字、start_url、standalone、192 与 512 图标）',
    manifest.name &&
      manifest.short_name &&
      manifest.start_url === '/' &&
      manifest.display === 'standalone' &&
      ['192x192', '512x512'].every((size) =>
        manifest.icons.some((i) => i.sizes === size && !i.purpose),
      ) &&
      manifest.icons.some((i) => i.purpose === 'maskable'),
  );
  for (const icon of manifest.icons) {
    const response = await fetch(base + icon.src);
    const png = Buffer.from(await response.arrayBuffer());
    // The PNG header holds the width and height at bytes 16 and 20.
    const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
    check(
      `图标 ${icon.src} 是 ${icon.sizes} 的 PNG`,
      response.ok &&
        response.headers.get('content-type') === 'image/png' &&
        size === icon.sizes,
      `${response.status} ${response.headers.get('content-type')} ${size}`,
    );
  }
  for (const path of ['/', '/ai/']) {
    const html = await (await fetch(base + path)).text();
    check(
      `${path} 的 <head> 引用 manifest`,
      html.includes('<link rel="manifest" href="/manifest.webmanifest"'),
    );
  }

  // ── Online: a friend room with a move in it ──
  const red = player(base);
  const black = player(base);
  const made = await red('POST', '/api/game', {
    action: 'create',
    name: 'Offline Red',
    side: 'red',
  });
  const joined = await black('POST', '/api/game', {
    action: 'join',
    room: made.id,
    version: made.version,
    name: 'Offline Black',
  });
  await red('POST', '/api/game', {
    action: 'move',
    room: made.id,
    version: joined.version,
    from: 64,
    to: 67,
  });

  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  // ── Online: /ai/ once, straight from the address bar ──
  await page.goto(`${base}/ai/`);
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new URL(registration.scope).pathname;
  });
  check('/ai/ 注册了 service worker，范围是整个站', scope === '/', scope);
  // The first visit loads before the worker exists: it saves the engine during its install.
  let files = {};
  for (let tries = 0; tries < 120; tries++) {
    files = await page.evaluate(savedFiles);
    const saved = Object.values(files)
      .flat()
      .map((file) => file.path);
    if (ENGINE.every((path) => saved.includes(path))) break;
    await sleep(250);
  }
  const saved = Object.values(files)
    .flat()
    .map((file) => file.path);
  check(
    '第一次打开 /ai/ 后引擎文件已存到设备上',
    ENGINE.every((path) => saved.includes(path)),
    `已存：${saved.join(' ')}`,
  );
  check(
    '大厅与 /ai/ 两个页面在安装时已存',
    saved.includes('/') && saved.includes('/ai/'),
  );
  const unisolated = Object.values(files)
    .flat()
    .filter(
      (file) =>
        file.path.startsWith('/ai/') &&
        (file.coop !== 'same-origin' || file.coep !== 'require-corp'),
    )
    .map((file) => file.path);
  check(
    '存下的 /ai/ 页面和引擎带着 COOP / COEP',
    !unisolated.length,
    unisolated.join(' '),
  );
  check(
    '页面已由 service worker 接管',
    await page.evaluate(() => !!navigator.serviceWorker.controller),
  );
  let errors = await installErrors(context, page);
  check('Chrome 认为 /ai/ 可以安装', !errors.length, errors.join(' '));

  // ── Online, controlled: the friend room and the lobby, and some /api/ requests ──
  await page.goto(`${base}/?room=${made.id}`);
  check(
    '联网时好友房间正常打开',
    await page
      .getByText('Offline Black')
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false),
  );
  await page.evaluate(async (room) => {
    await fetch('/api/me', { credentials: 'same-origin' });
    await fetch(`/api/game?room=${room}&wire=1`, {
      credentials: 'same-origin',
    });
  }, made.id);
  await page.goto(`${base}/`);
  await page.locator('.lobby-welcome').waitFor();
  errors = await installErrors(context, page);
  check('Chrome 认为大厅可以安装', !errors.length, errors.join(' '));
  // Signing in is a page load under /api/: it must pass through to the server and on to
  // Google (answered here by the test).
  await context.route('https://accounts.google.com/**', (route) =>
    route.fulfill({ body: 'Google', contentType: 'text/plain' }),
  );
  await page.goto(`${base}/api/auth/google?return=%2F`);
  check(
    '联网时登录跳转照常到 Google',
    new URL(page.url()).hostname === 'accounts.google.com',
    page.url(),
  );
  await page.goto(`${base}/`);
  await page.locator('.lobby-welcome').waitFor();
  files = await page.evaluate(savedFiles);
  check(
    '联网时没有任何 /api/ 响应进缓存',
    !apiSaved(files).length,
    apiSaved(files).join(' '),
  );

  // ── Offline ──
  await preview.stop();
  await context.setOffline(true);
  let response = await page.goto(`${base}/ai/`);
  check(
    '断网后 /ai/ 由 service worker 打开',
    !!response?.ok() && response.fromServiceWorker(),
    `${response?.status()}`,
  );
  check(
    '断网后 /ai/ 的响应仍带 COOP / COEP',
    response?.headers()['cross-origin-opener-policy'] === 'same-origin' &&
      response?.headers()['cross-origin-embedder-policy'] === 'require-corp',
  );
  check(
    '断网后 /ai/ 仍是跨源隔离（crossOriginIsolated）',
    await page.evaluate(() => crossOriginIsolated),
  );
  const start = page.getByRole('button', { name: 'Start playing' });
  const ready = await start
    .waitFor({ timeout: 30000 })
    .then(() => start.isEnabled())
    .catch(() => false);
  check('断网后人机页的引擎准备好（「Start playing」可点）', ready);
  const bestmove = await page
    .evaluate(engineSearch)
    .catch((error) => `失败：${error.message}`);
  check(
    '断网后引擎能搜索出一步棋',
    /^bestmove [a-i]\d+[a-i]\d+/.test(bestmove),
    bestmove,
  );

  response = await page.goto(`${base}/?game=x`);
  await page.locator('.lobby-welcome').waitFor({ timeout: 15000 });
  check(
    '断网后大厅外壳能打开（带查询参数也行）',
    !!response?.fromServiceWorker(),
  );

  await page.goto(`${base}/?room=${made.id}`);
  const offline = page.locator('.room-loading', {
    hasText: 'Cannot open the room right now',
  });
  check(
    '断网后好友房间报「打不开」，不显示旧棋局',
    await offline
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false),
  );

  files = await page.evaluate(savedFiles);
  check(
    '断网前后都没有任何 /api/ 响应进缓存',
    !apiSaved(files).length,
    apiSaved(files).join(' '),
  );

  // In a tab of its own: the browser's error page would cut the next navigation short.
  const other = await context.newPage();
  const privacy = await other.goto(`${base}/privacy.html`).then(
    () => 'opened',
    (error) => error.message.split('\n')[0],
  );
  check('断网后没存过的页面不拿大厅冒充', privacy !== 'opened', privacy);
  await other.close();

  // ── The off switch: the same build, its worker switched off ──
  const switchedOff = original.replace('"on":true', '"on":false');
  if (switchedOff === original) throw new Error('sw.js 里找不到 "on":true');
  await writeFile(SW_FILE, switchedOff);
  preview = await startPreview(port);
  await context.setOffline(false);
  const trouble = [];
  page.on('requestfailed', (request) =>
    trouble.push(`${request.url()} ${request.failure()?.errorText}`),
  );
  page.on('pageerror', (error) => trouble.push(error.message));
  // Any page load checks /sw.js for a new version, as browsers do for every visitor.
  await page.goto(`${base}/`);
  // Only the switched-off version deletes the current caches, so their going also shows the
  // browser picked it up. Its unregistering completes once Chrome lets it take over, when
  // the old version is idle, and the DevTools this test attaches can hold that off for
  // minutes: it is only noted. The pages of a real off build unregister it themselves.
  const left = () =>
    page.evaluate(async () => ({
      workers: (await navigator.serviceWorker.getRegistrations()).map(
        (r) =>
          `installing ${r.installing?.state}, waiting ${r.waiting?.state}, active ${r.active?.state}`,
      ),
      caches: (await caches.keys()).filter((key) => key.startsWith('chuhan-')),
    }));
  const until = async (done, seconds) => {
    const end = Date.now() + seconds * 1000;
    let now = await left();
    while (!done(now) && Date.now() < end) {
      await sleep(250);
      now = await left();
    }
    return now;
  };
  let after = await until((now) => !now.caches.length, 20);
  check(
    '关闭开关后，下一次打开页面就删掉存的全部文件',
    !after.caches.length,
    `还剩缓存：${after.caches.join(' ')}`,
  );
  after = await until((now) => !now.workers.length, 10);
  console.log(
    after.workers.length
      ? `· 注记：10 秒后注册还在（${after.workers.join('；')}），等旧版本空闲后完成`
      : '· 注记：service worker 已注销',
  );
  check(
    '关闭后页面照常从网络打开',
    await page
      .locator('.lobby-welcome')
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false),
    trouble.join('；'),
  );
  await context.close();
} finally {
  await browser.close();
  await preview.stop();
  await writeFile(SW_FILE, original);
}

console.log(
  `\n${passed} 项通过，${failures.length} 项失败${failures.length ? '：\n- ' + failures.join('\n- ') : ''}`,
);
process.exit(failures.length ? 1 : 0);
