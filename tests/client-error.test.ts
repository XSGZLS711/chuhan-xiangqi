import assert from 'node:assert/strict';
import { AppError } from '../lib/errors';
import { errorReport, withoutQueries } from '../lib/telemetry';
import {
  clientError,
  perMinute,
  REPORT_MAX_BYTES,
  REPORTS_PER_MINUTE,
} from '../worker/client-error';
import { visit, VISITS_PER_MINUTE } from '../worker/visit';

let checks = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  checks++;
  console.log('✓ ' + name);
}

const SITE = 'https://chess.example';
// Every console.error / console.log the handlers make, instead of printing them.
const logged: unknown[] = [];
const quiet = <T>(run: () => Promise<T>) => {
  const { error, log } = console;
  console.error = (...args: unknown[]) => logged.push(...args);
  console.log = (...args: unknown[]) => logged.push(...args);
  return run().finally(() => Object.assign(console, { error, log }));
};
const post = (
  path: string,
  body: BodyInit | null,
  headers: Record<string, string> = {},
) =>
  new Request(SITE + path, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      origin: SITE,
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      ...headers,
    },
  });
const report = {
  kind: 'engine',
  message: 'AppError: 象棋引擎启动失败，请刷新或更换浏览器。',
  code: 'engine-start-failed',
  stack: 'AppError: …\n    at https://chess.example/assets/ai-1.js:1:2',
  page: '/ai/',
  lang: 'en-GB',
  ui: 'en',
};
const plenty = () => true;

await test('同源的错误报告记进日志：消息、栈、路径、UA、语言，不带 Cookie', async () => {
  logged.length = 0;
  const response = await quiet(() =>
    clientError(
      post('/api/client-error', JSON.stringify(report), {
        cookie: 'chuhan_session=' + 'a'.repeat(64),
      }),
      plenty,
    ),
  );
  assert.equal(response.status, 204);
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], {
    message: 'client-error',
    kind: 'engine',
    error: report.message,
    code: 'engine-start-failed',
    stack: report.stack,
    page: '/ai/',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    lang: 'en-GB',
    ui: 'en',
  });
  assert(!JSON.stringify(logged).includes('chuhan_session'));
});

await test('别的网站发来的报告被拒绝，不记日志', async () => {
  logged.length = 0;
  const foreign: Record<string, string>[] = [
    { origin: 'https://evil.example' },
    { origin: SITE, 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of foreign) {
    const response = await quiet(() =>
      clientError(
        post('/api/client-error', JSON.stringify(report), headers),
        plenty,
      ),
    );
    assert.equal(response.status, 403);
    assert.equal(
      ((await response.json()) as { code: string }).code,
      'origin-mismatch',
    );
  }
  assert.equal(logged.length, 0);
});

await test('超过大小上限的报告不读完就拒绝，声明了长度和没声明都一样', async () => {
  logged.length = 0;
  const big = JSON.stringify({
    ...report,
    stack: 'x'.repeat(REPORT_MAX_BYTES),
  });
  const declared = await quiet(() =>
    clientError(post('/api/client-error', big), plenty),
  );
  assert.equal(declared.status, 413);
  // A streamed body has no Content-Length: the limit applies while reading.
  const chunks = new TextEncoder().encode(big);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let at = 0; at < chunks.length; at += 1024)
        controller.enqueue(chunks.slice(at, at + 1024));
      controller.close();
    },
  });
  const streamed = await quiet(() =>
    clientError(
      new Request(SITE + '/api/client-error', {
        method: 'POST',
        body: stream,
        headers: { origin: SITE },
        duplex: 'half',
      } as RequestInit),
      plenty,
    ),
  );
  assert.equal(streamed.status, 413);
  assert.equal(
    ((await streamed.json()) as { code: string }).code,
    'request-too-large',
  );
  assert.equal(logged.length, 0);
});

await test('不是 JSON 或没有消息的报告是坏请求', async () => {
  logged.length = 0;
  for (const body of ['not json', '[]', '{}', JSON.stringify({ message: 7 })]) {
    const response = await quiet(() =>
      clientError(post('/api/client-error', body), plenty),
    );
    assert.equal(response.status, 400, body);
  }
  assert.equal(logged.length, 0);
});

await test('过长的字段被截短，未知类型记为 error', async () => {
  logged.length = 0;
  await quiet(() =>
    clientError(
      post(
        '/api/client-error',
        JSON.stringify({
          kind: 'other',
          message: 'm'.repeat(900),
          stack: 's'.repeat(5000),
          page: '/' + 'p'.repeat(300),
        }),
      ),
      plenty,
    ),
  );
  const line = logged[0] as Record<string, string>;
  assert.equal(line.kind, 'error');
  assert.equal(line.error.length, 500);
  assert.equal(line.stack.length, 4000);
  assert.equal(line.page.length, 200);
});

await test('每分钟的报告数有上限，下一分钟重新计数', async () => {
  let now = 1_000_000;
  const budget = perMinute(REPORTS_PER_MINUTE);
  const allow = () => budget(now);
  logged.length = 0;
  const statuses: number[] = [];
  for (let i = 0; i < REPORTS_PER_MINUTE + 3; i++)
    statuses.push(
      (
        await quiet(() =>
          clientError(post('/api/client-error', JSON.stringify(report)), allow),
        )
      ).status,
    );
  assert.deepEqual(statuses, [
    ...Array(REPORTS_PER_MINUTE).fill(204),
    429,
    429,
    429,
  ]);
  assert.equal(logged.length, REPORTS_PER_MINUTE);
  now += 59_999;
  assert.equal(allow(), false);
  now += 1;
  const next = await quiet(() =>
    clientError(post('/api/client-error', JSON.stringify(report)), allow),
  );
  assert.equal(next.status, 204);
});

const load = {
  page: 'review',
  from: 'discord.com',
  lang: 'vi-VN',
  ui: 'en',
  touch: true,
};

await test('页面访问只记页面、来源网站、语言、是否触屏和国家', async () => {
  logged.length = 0;
  const response = await quiet(() =>
    visit(
      post(
        '/api/visit',
        JSON.stringify({ ...load, name: '棋友', room: 'abc' }),
        {
          cookie: 'chuhan_session=' + 'b'.repeat(64),
        },
      ),
      plenty,
    ),
  );
  assert.equal(response.status, 204);
  assert.deepEqual(logged, [
    {
      message: 'visit',
      page: 'review',
      from: 'discord.com',
      lang: 'vi-VN',
      ui: 'en',
      touch: true,
      country: '',
    },
  ]);
});

await test('页面访问也要同源、限大小、限频率，爬虫不计', async () => {
  logged.length = 0;
  const cross = await quiet(() =>
    visit(
      post('/api/visit', JSON.stringify(load), {
        origin: 'https://evil.example',
      }),
      plenty,
    ),
  );
  assert.equal(cross.status, 403);
  const big = await quiet(() =>
    visit(
      post('/api/visit', JSON.stringify({ ...load, from: 'x'.repeat(600) })),
      plenty,
    ),
  );
  assert.equal(big.status, 413);
  const unknown = await quiet(() =>
    visit(post('/api/visit', JSON.stringify({ page: 'admin' })), plenty),
  );
  assert.equal(unknown.status, 400);
  const robot = await quiet(() =>
    visit(
      post('/api/visit', JSON.stringify(load), {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      }),
      plenty,
    ),
  );
  assert.equal(robot.status, 204);
  assert.equal(logged.length, 0);
  const budget = perMinute(VISITS_PER_MINUTE);
  const now = 5_000_000;
  for (let i = 0; i < VISITS_PER_MINUTE; i++) budget(now);
  const over = await quiet(() =>
    visit(post('/api/visit', JSON.stringify(load)), () => budget(now)),
  );
  assert.equal(over.status, 429);
});

await test('报告里去掉网址的查询串和锚点：房间号、对局号不外传', () => {
  assert.equal(
    withoutQueries(
      'Failed to fetch https://chess.example/api/game?room=r1234&wait=1 (at https://chess.example/ai/?game=g9#ply-3)',
    ),
    'Failed to fetch https://chess.example/api/game (at https://chess.example/ai/)',
  );
  const where = { page: '/ai/', lang: 'en-US', ui: 'en' };
  const fromAppError = errorReport(
    'engine',
    new AppError('engine-unsupported'),
    where,
  );
  assert.equal(fromAppError.code, 'engine-unsupported');
  assert(fromAppError.message.startsWith('Error: '));
  const fromString = errorReport('rejection', 'plain reason', where);
  assert.deepEqual(fromString, {
    kind: 'rejection',
    message: 'plain reason',
    stack: undefined,
    code: undefined,
    ...where,
  });
});

console.log(`${checks} client report checks passed`);
