import assert from 'node:assert/strict';
import {
  authorizationUrl,
  base64url,
  accountName,
  googleAccount,
  pendingCookie,
  pkceChallenge,
  randomString,
  readPending,
  returnPath,
  withLoginNotice,
} from '../worker/google';

let checks = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  checks++;
  console.log('✓ ' + name);
}
const clientId = 'client.apps.googleusercontent.com';
const now = Date.UTC(2026, 10, 3);
const idToken = (claims: Record<string, unknown>) =>
  [
    'e30',
    base64url(new TextEncoder().encode(JSON.stringify(claims))),
    'signature',
  ].join('.');
const valid = {
  iss: 'https://accounts.google.com',
  aud: clientId,
  exp: now / 1000 + 600,
  nonce: 'nonce-1',
  sub: '1098765432101234567890',
  email: 'player@example.com',
  email_verified: true,
  name: '楚河汉界的棋友',
};
const expected = { clientId, nonce: 'nonce-1', now };

await test('PKCE 挑战符合 RFC 7636 的示例', async () => {
  assert.equal(
    await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});
await test('授权地址带上 PKCE、state、nonce，只要基本资料', () => {
  const pending = {
    state: randomString(),
    verifier: randomString(48),
    nonce: randomString(),
    back: '/',
  };
  const url = new URL(
    authorizationUrl(
      { id: clientId },
      'https://chess.example/api/auth/google/callback',
      pending,
      'challenge',
    ),
  );
  assert.equal(
    url.origin + url.pathname,
    'https://accounts.google.com/o/oauth2/v2/auth',
  );
  const q = url.searchParams;
  assert.equal(q.get('client_id'), clientId);
  assert.equal(
    q.get('redirect_uri'),
    'https://chess.example/api/auth/google/callback',
  );
  assert.equal(q.get('response_type'), 'code');
  assert.equal(q.get('scope'), 'openid email profile');
  assert.equal(q.get('state'), pending.state);
  assert.equal(q.get('nonce'), pending.nonce);
  assert.equal(q.get('code_challenge'), 'challenge');
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert(!q.has('client_secret'));
});
await test('登录后只回到本站路径，外站与畸形地址退回首页', () => {
  assert.equal(returnPath('/?room=abc'), '/?room=abc');
  assert.equal(
    returnPath('/ai/?game=friend%3Aa%3A1'),
    '/ai/?game=friend%3Aa%3A1',
  );
  for (const bad of [
    null,
    '',
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    '/' + 'a'.repeat(600),
  ])
    assert.equal(returnPath(bad), '/', String(bad));
  assert.equal(
    withLoginNotice('/?room=abc', 'failed'),
    '/?room=abc&login=failed',
  );
});
await test('登录途中的 Cookie 往返不变，被改动或缺项时作废', () => {
  const pending = {
    state: randomString(),
    verifier: randomString(48),
    nonce: randomString(),
    back: '/ai/?game=a.b',
  };
  const cookie = pendingCookie(pending, true);
  assert(cookie.includes('HttpOnly') && cookie.includes('Secure'));
  assert(
    cookie.includes('Path=/api/auth/google;') && cookie.includes('Max-Age=600'),
  );
  const pair = cookie.split(';')[0];
  assert.deepEqual(readPending('chuhan_session=x; ' + pair), pending);
  assert.equal(readPending(null), null);
  assert.equal(readPending('chuhan_oauth=short.short.short.%2F'), null);
  const evil = pendingCookie(
    { ...pending, back: 'https://evil.example' },
    false,
  );
  assert.equal(readPending(evil.split(';')[0])?.back, '/');
});
await test('读取 Google 账号：编号、已验证的邮箱和名字', () => {
  const account = googleAccount(idToken(valid), expected);
  assert.equal(account.subject, valid.sub);
  assert.equal(account.email, 'player@example.com');
  assert.equal(account.name, '楚河汉界的棋友');
  assert.equal(
    googleAccount(
      idToken({ ...valid, iss: 'accounts.google.com', name: 'x'.repeat(40) }),
      expected,
    ).name.length,
    32,
  );
  assert.equal(
    googleAccount(idToken({ ...valid, email_verified: false }), expected).email,
    '',
  );
  assert.equal(
    googleAccount(idToken({ ...valid, name: undefined }), expected).name,
    '棋友',
  );
});
await test('账号名最多 32 字，截断时不留下半个括号', () => {
  assert.equal(accountName('Lushan Zhang (Lucian)'), 'Lushan Zhang (Lucian)');
  assert.equal(
    accountName('Alexandra Catherine Montgomery (Alex)'),
    'Alexandra Catherine Montgomery',
  );
  assert.equal(
    accountName('欧阳'.repeat(14) + '（小名字很长）'),
    '欧阳'.repeat(14),
  );
  assert.equal(
    accountName('a'.repeat(20) + ' (Bo) ' + 'b'.repeat(20)).length,
    32,
  );
  assert.equal(
    accountName('😀'.repeat(40)),
    '😀'.repeat(32),
    '按字符而不是按 UTF-16 截',
  );
  assert.equal(accountName('  \u0007 '), '棋友');
  assert.equal(accountName(undefined), '棋友');
});
await test('签发方、受众、过期、nonce 或编号不对的令牌一律拒绝', () => {
  for (const claims of [
    { ...valid, iss: 'https://evil.example' },
    { ...valid, aud: 'other-client' },
    { ...valid, exp: now / 1000 - 1 },
    { ...valid, nonce: 'replayed' },
    { ...valid, sub: undefined },
    { ...valid, sub: '../../x' },
  ])
    assert.throws(
      () => googleAccount(idToken(claims), expected),
      JSON.stringify(claims),
    );
  assert.throws(() => googleAccount('not-a-token', expected));
});
console.log(`\n${checks} sign-in checks passed`);
