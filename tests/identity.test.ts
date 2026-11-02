import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identity, validateRequestOrigin } from '../worker/identity';
import { invitationUrl } from '../lib/client-api';

let checks = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  checks++;
  console.log('✓ ' + name);
}
const site = 'https://chess.example';
const request = (headers: Record<string, string> = {}, base = site) =>
  new Request(base + '/api/game', { headers });
const token = 'a'.repeat(64);

await test('同源页面的请求被允许，不带 Origin 的读取也被允许', () => {
  validateRequestOrigin(
    request({ Origin: site, 'Sec-Fetch-Site': 'same-origin' }),
  );
  validateRequestOrigin(request());
});
await test('拒绝其他来源与跨站请求', () => {
  assert.throws(() =>
    validateRequestOrigin(request({ Origin: 'https://evil.example' })),
  );
  assert.throws(() =>
    validateRequestOrigin(request({ Origin: site + '.evil.example' })),
  );
  assert.throws(() =>
    validateRequestOrigin(request({ 'Sec-Fetch-Site': 'cross-site' })),
  );
  assert.throws(() =>
    validateRequestOrigin(request({ Origin: 'http://chess.example' })),
  );
});
await test('新访客获得 HttpOnly、SameSite 的会话 Cookie，线上带 Secure', async () => {
  const first = await identity(request());
  assert(
    first.cookie.includes('HttpOnly') && first.cookie.includes('SameSite=Lax'),
  );
  assert(first.cookie.includes('Secure'));
  const local = await identity(request({}, 'http://localhost:5173'));
  assert(!local.cookie.includes('Secure'));
});
await test('带原 Cookie 刷新后身份不变且不再下发新 Cookie', async () => {
  const first = await identity(request());
  const pair = first.cookie.split(';')[0];
  const again = await identity(request({ Cookie: pair }));
  assert.equal(first.id, again.id);
  assert.equal(again.cookie, '');
});
await test('不同玩家身份不同，存储的身份是令牌的哈希而非令牌本身', async () => {
  const a = await identity(request({ Cookie: 'chuhan_session=' + token }));
  const b = await identity(
    request({ Cookie: 'chuhan_session=' + 'b'.repeat(64) }),
  );
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.id, token);
  assert.match(a.id, /^[a-f0-9]{64}$/);
});
await test('格式不对的 Cookie 被忽略并重新发放，不会成为他人身份', async () => {
  const odd = await identity(request({ Cookie: 'chuhan_session=short' }));
  assert(odd.cookie.startsWith('chuhan_session='));
  const forged = await identity(request({ 'X-Chuhan-Session': token }));
  assert(forged.cookie.length > 0, '旧的请求头凭证不再被接受');
});
await test('邀请链接指向站点根路径并保留房间号', () => {
  assert.equal(invitationUrl(site, '/', 'abc'), site + '/?room=abc');
  assert.equal(invitationUrl(site, '/ai/', 'abc'), site + '/ai/?room=abc');
});
await test('页面的联机请求只经过统一的同源客户端', () => {
  const source = readFileSync('app/page.tsx', 'utf8');
  assert(!/\bfetch\('/.test(source));
  assert(!source.includes('href="/"'));
  assert(
    /invitationUrl\(\s*location\.origin\s*,\s*location\.pathname\s*,\s*room\.id\s*\)/.test(
      source,
    ),
  );
});
await test('AI 页及引擎文件下发隔离响应头', () => {
  const headers = readFileSync('public/_headers', 'utf8');
  for (const path of ['/ai', '/ai/*']) {
    const block = headers
      .split(/\n(?=\S)/)
      .find((b) => b.startsWith(path + '\n'));
    assert(block, path + ' 缺少响应头规则');
    assert(block.includes('Cross-Origin-Opener-Policy: same-origin'));
    assert(block.includes('Cross-Origin-Embedder-Policy: require-corp'));
  }
});
await test('只有 /api/* 唤醒 Worker，页面访问走静态资源', () => {
  const config = readFileSync('wrangler.jsonc', 'utf8').replace(
    /^\s*\/\/.*$/gm,
    '',
  );
  const parsed = JSON.parse(config);
  assert.deepEqual(parsed.assets.run_worker_first, ['/api/*']);
  assert.equal(parsed.assets.html_handling, 'auto-trailing-slash');
  assert.equal(parsed.d1_databases[0].binding, 'DB');
  assert.equal(parsed.env.staging.d1_databases[0].binding, 'DB');
});
console.log(`\n${checks} identity & deployment checks passed`);
