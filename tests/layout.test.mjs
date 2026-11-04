// npm run test:layout  (builds, then: node tests/layout.test.mjs [--locale=vi,en] [--width=412,360] [--jobs=4])
// Opens the production build in Chromium (`vite preview`) in every language at every width,
// signed in and signed out, and fails when the header or a dialog leaves the screen, a dialog
// sits off centre, the page or a dialog scrolls sideways, or a button cuts its own label.
// Everything found lands in work/layout/: report.md and a screenshot of each failure.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { availableParallelism } from 'node:os';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const list = (name, all) =>
  option(name)
    ? all.filter((value) => option(name).split(',').includes(String(value)))
    : all;
const LOCALES = list('locale', ['zh', 'en', 'vi']);
const WIDTHS = list('width', [320, 360, 375, 390, 412, 430, 768, 1024, 1280]);
const JOBS = Number(option('jobs')) || Math.min(6, availableParallelism());
const OUT = 'work/layout';
// A real device at each width. Phones and the tablet are emulated as touch screens with a
// mobile viewport, so a page pushed wider than the screen behaves as on a phone: Chrome
// zooms out, and fixed dialogs centre in the wider page.
const DEVICES = {
  320: { height: 568, phone: true },
  360: { height: 780, phone: true },
  375: { height: 667, phone: true },
  390: { height: 844, phone: true },
  412: { height: 915, phone: true },
  430: { height: 932, phone: true },
  768: { height: 1024, phone: true },
  1024: { height: 768, phone: false },
  1280: { height: 800, phone: false },
};
// One browser context per group: a page loads at the group's first width, and every check
// is then made at each width of the group by resizing (reloading for each would take
// several times as long).
const GROUPS = [
  [320, 360, 375, 390],
  [412, 430, 768],
  [1024, 1280],
]
  .map((group) => group.filter((width) => WIDTHS.includes(width)))
  .filter((group) => group.length);
const BROWSER_LOCALE = { zh: 'zh-CN', en: 'en-US', vi: 'vi-VN' };
// Base UI dialogs (建房, 邀请, 改名, 对局规则, AI 开局设置, AI 认输) and alert dialogs (认输确认).
const DIALOG =
  '[data-slot="dialog-content"]:not([data-closed]), [data-slot="alert-dialog-content"]:not([data-closed])';
const ACCOUNT = {
  id: `layout-check-${randomBytes(6).toString('hex')}`,
  name: 'Trần Minh Khoa',
  email: 'tran.minh.khoa@example.com',
  token: randomBytes(32).toString('hex'),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} ${commandArgs.join(' ')}\n${output}`)),
    );
  });
}
const sql = (value) =>
  typeof value === 'number'
    ? String(value)
    : `'${value.replaceAll("'", "''")}'`;
async function d1(statements) {
  const file = `${OUT}/seed.sql`;
  await writeFile(file, statements.join(';\n') + ';\n');
  try {
    await run('npx', [
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--file',
      file,
    ]);
  } finally {
    await rm(file, { force: true });
  }
}
// Leftovers from an interrupted run go too: every test account's id starts the same way.
const forgetAccounts = [
  "DELETE FROM archived_games WHERE user_id LIKE 'layout-check-%'",
  "DELETE FROM sessions WHERE user_id LIKE 'layout-check-%'",
  "DELETE FROM identities WHERE user_id LIKE 'layout-check-%'",
  "DELETE FROM users WHERE id LIKE 'layout-check-%'",
];
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

/** The production build on this machine. Sign-in needs a Google client, which only the
 * owner's .dev.vars has; placeholder values in this process's environment are enough for
 * the server to offer it, so the 登录 button shows as it does on the site. They are written
 * nowhere, and the button is never pressed. */
async function startPreview() {
  const port = await freePort();
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(port), '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: {
        ...process.env,
        CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'layout-check',
        GOOGLE_CLIENT_SECRET:
          process.env.GOOGLE_CLIENT_SECRET || 'layout-check',
      },
    },
  );
  let log = '';
  server.stdout.on('data', (chunk) => (log += chunk));
  server.stderr.on('data', (chunk) => (log += chunk));
  const base = `http://localhost:${port}`;
  const stop = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {}
  };
  for (let tries = 0; tries < 240; tries++) {
    if (server.exitCode !== null) break;
    try {
      // Without a cookie this answers without touching D1, which is still being seeded.
      if ((await fetch(`${base}/api/me`)).ok) return { base, stop };
    } catch {}
    await sleep(250);
  }
  stop();
  throw new Error(`vite preview 没有启动：\n${log}`);
}

/** A player talking to the room API directly, as tests/online.test.mjs does. */
function player(base, cookie = '') {
  return {
    get cookie() {
      return cookie;
    },
    async request(method, path, body) {
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
    },
  };
}

/** Two timed rooms between the signed-in account (red) and an anonymous friend (black): one
 * being played, one the friend has resigned after a few moves. */
async function makeRooms(me, friend) {
  async function room() {
    const made = await me.request('POST', '/api/game', {
      action: 'create',
      name: 'Nguyễn Minh Khoa',
      clockMinutes: 10,
      side: 'red',
    });
    return friend.request('POST', '/api/game', {
      action: 'join',
      room: made.id,
      version: made.version,
      name: 'Lan Anh',
    });
  }
  const playing = await room();
  let ended = await room();
  const act = async (who, action, extra = {}) =>
    (ended = await who.request('POST', '/api/game', {
      action,
      room: ended.id,
      version: ended.version,
      ...extra,
    }));
  await act(me, 'move', { from: 64, to: 67 });
  await act(friend, 'move', { from: 19, to: 22 });
  await act(me, 'move', { from: 70, to: 52 });
  await act(friend, 'resign');
  return { playing: playing.id, ended: ended.id };
}

// ── What is measured, inside the page ──
/** Runs in the page: what is wrong with the page (`popup` null) or with one open popup. */
function inspect({ width, popup, centered }) {
  const problems = [];
  const allowed = [];
  const px = (n) => `${Math.round(n * 10) / 10} px`;
  const describe = (el) => {
    let text = el.tagName.toLowerCase();
    // shadcn parts are named by data-slot; their classes are mostly Tailwind utilities.
    const slot = el.getAttribute('data-slot');
    const classes = [...el.classList].filter((c) =>
      /^[a-z][a-z0-9-]*$/.test(c),
    );
    if (slot) text += `[${slot}]`;
    else if (classes.length) text += '.' + classes.slice(0, 3).join('.');
    // What a person reads: hidden menus and panels inside it are left out.
    const label = (el.getAttribute('aria-label') || el.innerText || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (label)
      text += `「${label.length > 40 ? label.slice(0, 40) + '…' : label}」`;
    return text;
  };
  const shown = (el) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      return false;
    const box = el.getBoundingClientRect();
    return box.width > 1 && box.height > 1;
  };
  // The part of the box anyone can see: ancestors that clip their overflow cut it.
  // (The body's and the root's overflow belong to the viewport, measured on its own.)
  const seen = (el, within = document.body) => {
    let { left, right } = el.getBoundingClientRect();
    for (
      let a = el.parentElement;
      a && a !== within && a !== document.body;
      a = a.parentElement
    ) {
      if (getComputedStyle(a).overflowX === 'visible') continue;
      const box = a.getBoundingClientRect();
      left = Math.max(left, box.left);
      right = Math.min(right, box.right);
    }
    return { left, right };
  };
  /** The outermost visible elements under `root` (itself excluded) reaching past `limit`;
   * with `inside`, what `root` itself scrolls out of sight counts too. */
  /** Positioned out of the flow, itself or by an ancestor below `root`. */
  const placed = (el, root) => {
    for (let a = el; a && a !== root; a = a.parentElement)
      if (['absolute', 'fixed'].includes(getComputedStyle(a).position))
        return true;
    return false;
  };
  function reaching(root, limit, most = 3, inside = false) {
    const found = [];
    for (const el of root.querySelectorAll('*')) {
      if (found.length >= most) break;
      if (found.some((f) => f.contains(el)) || !shown(el)) continue;
      // A backdrop covering the widened page follows the overflow; it does not cause it.
      const box = el.getBoundingClientRect();
      if (
        getComputedStyle(el).position === 'fixed' &&
        box.left <= 0.5 &&
        box.right >= innerWidth - 0.5
      )
        continue;
      const { right } = seen(el, inside ? root : document.body);
      const edge = typeof limit === 'number' ? limit : limit(placed(el, root));
      if (right > edge + 0.5) found.push(el);
    }
    return found.map(describe).join('；');
  }
  /** Outermost visible elements under `root` that reach past either side of the screen. */
  function outside(root) {
    const found = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (found.some((f) => f.contains(el)) || !shown(el)) continue;
      const { left, right } = seen(el);
      if (right - left <= 0) continue;
      const over = Math.max(-left, right - width);
      if (over > 0.5) {
        found.push(el);
        const inside = reaching(el, width);
        problems.push({
          kind: '超出视口',
          element: describe(el),
          detail: `超出 ${px(over)}（左 ${px(left)}，右 ${px(right)}，屏宽 ${width} px）${inside ? `，伸出去的有：${inside}` : ''}`,
        });
      }
    }
  }
  /** The lines of text under `el`, as laid out: an ellipsis or a clip does not shorten them. */
  function lines(el) {
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || !shown(node.parentElement)) continue;
      range.selectNodeContents(node);
      rects.push(...[...range.getClientRects()].filter((r) => r.width > 0));
    }
    return rects;
  }
  /** A label cut short: a box in the button hides its overflow while the text runs past its
   * sides (an ellipsis, cut glyphs) or a whole line falls outside it; or a box around the
   * button hides the part of the label that does not fit. */
  function cut(button) {
    for (const el of [button, ...button.querySelectorAll('*')]) {
      if (!el.textContent.trim() || !shown(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'inline' || style.overflowX === 'visible') continue;
      const box = el.getBoundingClientRect();
      const left = box.left + el.clientLeft;
      const right = left + el.clientWidth;
      const top = box.top + el.clientTop;
      const bottom = top + el.clientHeight;
      const text = lines(el);
      if (!text.length) continue;
      const start = Math.min(...text.map((r) => r.left));
      const end = Math.max(...text.map((r) => r.right));
      const hidden = text.filter((r) => {
        const middle = (r.top + r.bottom) / 2;
        return middle < top || middle > bottom;
      }).length;
      if (
        el.scrollWidth > el.clientWidth &&
        (end > right + 1 || start < left - 1)
      )
        return `${describe(el)} 宽 ${px(right - left)}，文字要 ${px(end - start)}（overflow: ${style.overflowX}${style.textOverflow === 'ellipsis' ? '，显示省略号' : ''}）`;
      if (hidden)
        return `${describe(el)} 高 ${px(bottom - top)}，${hidden} 行文字在框外（overflow: ${style.overflowY}）`;
    }
    const text = lines(button);
    if (!text.length) return null;
    const start = Math.min(...text.map((r) => r.left));
    const end = Math.max(...text.map((r) => r.right));
    // A list that scrolls sideways is not cutting anything off.
    for (
      let a = button.parentElement;
      a && a !== document.body;
      a = a.parentElement
    ) {
      const style = getComputedStyle(a);
      if (!['hidden', 'clip'].includes(style.overflowX)) continue;
      const box = a.getBoundingClientRect();
      if (end > box.right + 1 || start < box.left - 1)
        return `被 ${describe(a)} 裁掉：文字在 ${px(start)}–${px(end)}，外框只到 ${px(box.left)}–${px(box.right)}（overflow: ${style.overflowX}）`;
    }
    return null;
  }
  const BUTTONS =
    'button, summary, [role="button"], [role="tab"], [role="menuitem"], a[class*="button"], a.lobby-mode';
  const POPUPS = '[role="dialog"], [role="alertdialog"], [role="menu"]';
  function buttons(root) {
    const own = root.matches(BUTTONS) ? [root] : [];
    for (const button of [...own, ...root.querySelectorAll(BUTTONS)]) {
      // The page leaves open popups to their own check.
      if (root === document.body && button.closest(POPUPS)) continue;
      if (!shown(button)) continue;
      const how = cut(button);
      if (how)
        problems.push({
          kind: '按钮文字被截断',
          element: describe(button),
          detail: how,
        });
    }
    // The brand may end in an ellipsis by design (PR #17): it is listed, not failed.
    for (const brand of root.querySelectorAll('.brand')) {
      if (!shown(brand)) continue;
      const how = cut(brand);
      if (how)
        allowed.push({
          kind: '品牌名省略号（按设计允许）',
          element: describe(brand),
          detail: how,
        });
    }
  }
  /** The popup, or a box in it that scrolls, being wider inside than it is. */
  function sideways(root) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const style = getComputedStyle(el);
      const scrolls =
        el === root || ['auto', 'scroll'].includes(style.overflowX);
      if (!scrolls || !shown(el) || el.scrollWidth <= el.clientWidth) continue;
      const box = el.getBoundingClientRect();
      // What flows past the edge of the content is what scrollWidth counts; what is placed
      // (a corner close button) may sit in the padding.
      const padding = box.left + el.clientLeft + el.clientWidth;
      const content = padding - parseFloat(style.paddingRight);
      const inside = reaching(el, (out) => (out ? padding : content), 3, true);
      problems.push({
        kind: '内部横向滚动',
        element: describe(el),
        detail: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}（overflow-x: ${style.overflowX}）${inside ? `，撑宽的有：${inside}` : ''}`,
      });
    }
  }

  if (!popup) {
    const page = document.scrollingElement;
    if (page.scrollWidth > page.clientWidth || innerWidth > width + 0.5) {
      const inside = reaching(document.body, width, 5);
      problems.push({
        kind: '页面横向滚动',
        element: inside || 'html',
        detail: `页面宽 ${page.scrollWidth} px，屏宽 ${width} px${innerWidth > width + 0.5 ? `，手机会把页面缩小成 ${innerWidth} px 宽` : ''}`,
      });
    }
    for (const header of document.querySelectorAll(
      'header, .mobile-room-nav, .ai-mobile-nav',
    ))
      if (shown(header)) outside(header);
    buttons(document.body);
    return { problems, allowed };
  }
  const root = [...document.querySelectorAll(popup)].filter(shown).at(-1);
  if (!root) {
    problems.push({
      kind: '没有打开',
      element: popup,
      detail: '找不到可见的弹窗',
    });
    return { problems, allowed };
  }
  outside(root);
  if (centered) {
    const box = root.getBoundingClientRect();
    const left = box.left;
    const right = width - box.right;
    if (Math.abs(left - right) > 1)
      problems.push({
        kind: '弹窗没有居中',
        element: describe(root),
        detail: `左边距 ${px(left)}，右边距 ${px(right)}，差 ${px(Math.abs(left - right))}`,
      });
  }
  sideways(root);
  buttons(root);
  return { problems, allowed };
}

/** Moves every animation that ends to its end (entrances, fades, a dialog's zoom), so what
 * is measured is where things come to rest, and a closed dialog's backdrop is gone at once.
 * Loops keep running. */
async function finish(page) {
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    for (let round = 0; round < 5; round++) {
      const ending = document
        .getAnimations()
        .filter(
          (a) =>
            ['running', 'paused'].includes(a.playState) &&
            a.effect?.getComputedTiming().endTime !== Infinity,
        );
      if (!ending.length) break;
      for (const animation of ending)
        try {
          animation.finish();
        } catch {}
      await frame();
    }
    await frame();
  });
}

/** The one of these that is on screen, for controls that move between layouts. */
async function visible(page, selectors) {
  const found = page.locator(selectors.join(', ')).filter({ visible: true });
  return (await found.count()) ? found.first() : null;
}
/** Clicks like a person; a control pushed off the screen (which the checks report) is
 * still pressed, so the dialog behind it gets checked too. */
async function tap(locator) {
  try {
    await locator.click({ timeout: 3000 });
  } catch {
    await locator.dispatchEvent('click');
  }
}
/** Desktop shows the action as a button; phones put it in the dock's menu or a panel. */
async function press(page, icon, menus) {
  const direct = await visible(page, [
    `.desktop-game-actions button:has(svg.${icon})`,
    `.ai-desktop-actions button:has(svg.${icon})`,
    `header button:has(svg.${icon})`,
    `.ai-mobile-nav button:has(svg.${icon})`,
  ]);
  if (direct) return tap(direct);
  const menu = await visible(page, menus);
  if (!menu) throw new Error(`找不到 ${icon} 的入口`);
  await menu.click();
  const item = page
    .locator(
      `[role="menuitem"]:has(svg.${icon}), .mobile-action-panel button:has(svg.${icon})`,
    )
    .filter({ visible: true })
    .first();
  await item.waitFor({ timeout: 5000 });
  await item.click();
}

// ── One language, one group of widths, signed in or out, the club or the AI page ──
const results = [];
const allowedList = [];
const errors = [];
let checks = 0;

async function session(task, base, rooms, states) {
  const { locale, widths, signedIn, part } = task;
  const { phone } = DEVICES[widths[0]];
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: widths[0], height: DEVICES[widths[0]].height },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    locale: BROWSER_LOCALE[locale],
    storageState: signedIn ? states.me : states.friend,
  });
  context.setDefaultTimeout(15000);
  await context.addInitScript((code) => {
    try {
      localStorage.setItem('chuhan-locale', code);
    } catch {}
    // Copying fails here, so the room's invite button opens the 邀请 dialog (the one a new
    // room opens with) rather than copying the link.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('layout check')) },
    });
  }, locale);
  const page = await context.newPage();
  const who = signedIn ? '已登录' : '未登录';
  const shot = async (view, width) => {
    const file = `${OUT}/${locale}-${width}-${signedIn ? 'in' : 'out'}-${view.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;
    await page.screenshot({ path: file }).catch(() => {});
    return file;
  };
  /** Every width of the group, the page resized to each in turn. */
  async function check(view, popup = null, centered = true) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: DEVICES[width].height });
      await page.evaluate(() => document.fonts.ready);
      await finish(page);
      checks++;
      const found = await page.evaluate(inspect, { width, popup, centered });
      for (const item of found.allowed)
        allowedList.push({ locale, width, who, view, ...item });
      if (!found.problems.length) continue;
      const screenshot = await shot(view, width);
      for (const problem of found.problems)
        results.push({ locale, width, who, view, ...problem, screenshot });
    }
  }
  async function step(view, body) {
    try {
      await body();
    } catch (error) {
      errors.push({
        where: `${locale} · ${widths.join('/')} px · ${who} · ${view}`,
        message: error.message.split('\n')[0],
        screenshot: await shot(`出错-${view}`, page.viewportSize().width),
      });
    }
  }
  async function dialog(view, open, selector = DIALOG, centered = true) {
    await step(view, async () => {
      await open();
      await page.locator(selector).first().waitFor({ state: 'visible' });
      await check(view, selector, centered);
      await page.keyboard.press('Escape');
      await finish(page);
      await page.locator(DIALOG).first().waitFor({ state: 'hidden' });
    });
  }
  async function menu(view, details, panel) {
    await step(view, async () => {
      await tap(page.locator(`${details} > summary`));
      await page.locator(panel).waitFor({ state: 'visible' });
      await check(view, panel, false);
      await page.evaluate((selector) => {
        document.querySelector(selector).open = false;
      }, details);
    });
  }

  if (part === 'club') {
    await step('大厅', async () => {
      await page.goto('/');
      await page.locator('.game-lobby').waitFor();
      await page
        .locator(
          signedIn ? '.account-menu' : 'header button:has(svg.lucide-log-in)',
        )
        .first()
        .waitFor();
      await check('大厅');
    });
    if (signedIn) {
      await menu('账号菜单', '.account-menu', '.account-panel');
      await menu('语言菜单', '.locale-menu', '.locale-panel');
      await dialog('对局规则', () => tap(page.locator('header .rules-button')));
      await dialog('建房', () => tap(page.locator('.lobby-mode-friend')));
      await step('推演页', async () => {
        await tap(page.locator('.lobby-explore'));
        await page.locator('.is-analysis').waitFor();
        await check('推演页');
      });
    }
    await step('好友房', async () => {
      await page.goto(`/?room=${rooms.playing}`);
      await page
        .locator('.in-room .player-bar .player-tag')
        .first()
        .waitFor({ state: 'attached' });
      await check('好友房');
    });
    if (signedIn) {
      // Dispatched: on the narrowest phones the link can be cut off (the room's own check
      // reports that), and the dialog behind it is still worth checking.
      await dialog('改名', () =>
        page.locator('.player-bar .inline-link').first().dispatchEvent('click'),
      );
      await dialog('邀请', async () => {
        const button = await visible(page, [
          '.mobile-invite',
          '.invite-panel .primary-button',
        ]);
        if (!button) throw new Error('找不到邀请入口');
        await tap(button);
      });
      await dialog('认输确认', () =>
        press(page, 'lucide-flag', ['.dock-menu', '.actions-trigger']),
      );
      await step('好友房终局', async () => {
        await page.goto(`/?room=${rooms.ended}`);
        await page
          .locator('.game-ended .endgame-panel')
          .waitFor({ state: 'attached' });
        await check('好友房终局');
      });
    }
  } else {
    // Signed out, the engine is held back, so the setup dialog and the review show it
    // loading, as everyone first sees them; signed in, both are checked once it is ready
    // (the review from its saved analysis, as on a second visit).
    if (!signedIn) await context.route('**/ai/engine-host.js', () => {});
    await step('AI 开局设置', async () => {
      await page.goto('/ai/');
      await page
        .locator(
          `.ai-setup .primary-button:has(svg.lucide-bot)${signedIn ? ':not([disabled])' : '[disabled]'}`,
        )
        .waitFor({ timeout: 30000 });
      await check('AI 页（开局设置下）');
      await check(
        signedIn ? 'AI 开局设置' : 'AI 开局设置（引擎加载中）',
        DIALOG,
      );
    });
    if (signedIn) {
      await step('AI 对局页', async () => {
        await page.locator('.ai-setup .primary-button').click();
        await page.locator(DIALOG).first().waitFor({ state: 'hidden' });
        await page.locator('.ai-room.in-room').waitFor();
        await check('AI 对局页');
      });
      await dialog('AI 认输确认', () =>
        press(page, 'lucide-flag', ['.ai-dock .dock-menu']),
      );
      await dialog('AI 开局设置（对局中）', () =>
        press(page, 'lucide-settings-2', ['.ai-dock .dock-menu']),
      );
    }
    await step('复盘页', async () => {
      await page.goto(`/ai/?game=${encodeURIComponent(rooms.archived)}`);
      await page.locator('.review-screen').waitFor();
      if (signedIn)
        await page
          .locator('.review-progress')
          .waitFor({ state: 'detached', timeout: 30000 });
      await check(signedIn ? '复盘页（分析完成）' : '复盘页（分析中）');
    });
  }
  await context.close();
}

/** Each browser opens the finished room once, which keeps it in 最近对局 there (and in the
 * account); the account's browser also lets the review analyse it. What they keep, cookie
 * and IndexedDB included, then seeds every session. */
async function remember(base, cookie, rooms, review) {
  const context = await browser.newContext({ baseURL: base });
  await context.addCookies([
    {
      name: 'chuhan_session',
      value: cookie.split('=')[1],
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  await page.goto(`/?room=${rooms.ended}`);
  await page.locator('.game-ended').waitFor();
  await page.waitForFunction(
    (id) =>
      new Promise((resolve) => {
        const request = indexedDB.open('chuhan-archive');
        request.onsuccess = () => {
          const get = request.result
            .transaction('games')
            .objectStore('games')
            .get(id);
          get.onsuccess = () => resolve(!!get.result);
          get.onerror = () => resolve(false);
        };
        request.onerror = () => resolve(false);
      }),
    rooms.archived,
  );
  if (review) {
    await page.goto(`/ai/?game=${encodeURIComponent(rooms.archived)}`);
    await page.locator('.review-screen').waitFor();
    await page
      .locator('.review-progress')
      .waitFor({ state: 'detached', timeout: 60000 });
  }
  const state = await context.storageState({ indexedDB: true });
  await context.close();
  return state;
}

// ── Setting up, running, cleaning up ──
const started = Date.now();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const starting = startPreview();
starting.catch(() => {});
let server = null;
let browser = null;
let removed = false;
try {
  await run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local']);
  const now = Date.now();
  await d1([
    ...forgetAccounts,
    `INSERT INTO users (id, name, created_at) VALUES (${sql(ACCOUNT.id)}, ${sql(ACCOUNT.name)}, ${now})`,
    `INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES ('google', ${sql(ACCOUNT.id)}, ${sql(ACCOUNT.id)}, ${sql(ACCOUNT.email)}, ${now})`,
    `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (${sql(createHash('sha256').update(ACCOUNT.token).digest('hex'))}, ${sql(ACCOUNT.id)}, ${now}, ${now + 86400000})`,
  ]);
  server = await starting;
  const { base } = server;
  const me = player(base, `chuhan_session=${ACCOUNT.token}`);
  const status = await me.request('GET', '/api/me');
  if (status.user?.name !== ACCOUNT.name || !status.google)
    throw new Error(`测试账号没有登录上：${JSON.stringify(status)}`);
  const friend = player(base);
  await friend.request('GET', '/api/game');
  const rooms = await makeRooms(me, friend);
  rooms.archived = `friend:${rooms.ended}:1`;

  browser = await chromium.launch();
  const [mine, theirs] = await Promise.all([
    remember(base, me.cookie, rooms, true),
    remember(base, friend.cookie, rooms, false),
  ]);
  const states = { me: mine, friend: theirs };
  const queue = [];
  // The heaviest first, so the last few finish together.
  for (const part of ['ai', 'club'])
    for (const signedIn of [true, false])
      for (const locale of LOCALES)
        for (const widths of GROUPS)
          queue.push({ locale, widths, signedIn, part });
  await Promise.all(
    Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
      for (let task; (task = queue.shift());)
        await session(task, base, rooms, states);
    }),
  );

  // The account goes the way a person deletes theirs: sessions, saved games and seats.
  await me.request('DELETE', '/api/me');
  removed =
    (await player(base, me.cookie).request('GET', '/api/me')).user === null;
} finally {
  await browser?.close();
  server ??= await starting.catch(() => null);
  server?.stop();
  if (!removed)
    await d1(forgetAccounts).catch((error) => console.error(error.message));
}

// ── Report ──
// In the order the pages are visited, then by language, width, signed in before out.
const VIEWS = [
  '大厅',
  '账号菜单',
  '语言菜单',
  '对局规则',
  '建房',
  '推演页',
  '好友房',
  '改名',
  '邀请',
  '认输确认',
  '好友房终局',
  'AI 页（开局设置下）',
  'AI 开局设置',
  'AI 开局设置（引擎加载中）',
  'AI 对局页',
  'AI 认输确认',
  'AI 开局设置（对局中）',
  '复盘页（分析完成）',
  '复盘页（分析中）',
];
const rank = (r) => [
  VIEWS.indexOf(r.view),
  LOCALES.indexOf(r.locale),
  r.width,
  r.who === '未登录' ? 1 : 0,
];
const byRank = (a, b) => {
  const x = rank(a);
  const y = rank(b);
  const i = x.findIndex((value, j) => value !== y[j]);
  return i < 0 ? 0 : x[i] - y[i];
};
results.sort(byRank);
allowedList.sort(byRank);
const lines = [];
const where = (rows) =>
  [
    ...new Set(
      rows.map(
        (r) =>
          `${r.locale} ${r.width}${r.who === '未登录' ? '（未登录）' : ''}`,
      ),
    ),
  ].join('、');
const grouped = (rows, key) => {
  const groups = new Map();
  for (const row of rows)
    groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};
const failures = grouped(
  results,
  (r) => `${r.view} · ${r.kind} · ${r.element}`,
);
lines.push('# 版面检查', '');
lines.push(
  `${LOCALES.join('/')} × ${WIDTHS.join('/')} px × 已登录/未登录：${checks} 项检查，${results.length} 个问题（${failures.size} 类），${errors.length} 处没能检查，用时 ${Math.round((Date.now() - started) / 1000)} 秒。`,
  '',
);
if (failures.size) {
  lines.push('## 失败', '');
  for (const [key, rows] of failures) {
    lines.push(`- **${key}**`);
    lines.push(`  - 出现在：${where(rows)}`);
    lines.push(
      `  - 例：${rows[0].locale} ${rows[0].width} px：${rows[0].detail}（截图 ${rows[0].screenshot}）`,
    );
  }
  lines.push('');
}
if (errors.length) {
  lines.push('## 没能检查', '');
  for (const e of errors)
    lines.push(`- ${e.where}：${e.message}（截图 ${e.screenshot}）`);
  lines.push('');
}
if (allowedList.length) {
  lines.push('## 允许的省略号（品牌名）', '');
  for (const [key, rows] of grouped(
    allowedList,
    (r) => `${r.view} · ${r.element}`,
  ))
    lines.push(`- ${key}：${where(rows)}`);
  lines.push('');
}
const report = lines.join('\n');
await writeFile(`${OUT}/report.md`, report);
console.log(report);
if (!removed)
  console.log('注意：测试账号没能通过接口删除，已直接从本地 D1 删除。');
process.exit(results.length || errors.length ? 1 : 0);
