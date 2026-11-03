import { LogIn, LogOut } from 'lucide-react';
import type { useAccount } from '@/lib/use-account';

// A static page in public/, outside the React app.
const PRIVACY_PAGE = '/privacy';
// The first character as people see it, even for an emoji or a combined glyph.
const initial = (name: string) =>
  new Intl.Segmenter('zh', { granularity: 'grapheme' })
    .segment(name)
    [Symbol.iterator]()
    .next().value?.segment ?? '棋';

/** Google sign-in in the page header. Nothing shows until sign-in is configured. */
export default function AccountMenu({
  account,
}: {
  account: ReturnType<typeof useAccount>;
}) {
  const { user } = account;
  if (user)
    return (
      <details className="account-menu">
        <summary aria-label={`账号：${user.name}`} title={user.name}>
          <span aria-hidden="true">{initial(user.name)}</span>
        </summary>
        <div className="account-panel">
          <strong>{user.name}</strong>
          {user.email && <small>{user.email}</small>}
          <button
            className="secondary-button"
            disabled={account.busy}
            onClick={() => void account.signOut()}
          >
            <LogOut size={15} />
            {account.busy ? '请稍候…' : '退出登录'}
          </button>
          <div className="account-links">
            <a href={PRIVACY_PAGE}>隐私说明</a>
            <button disabled={account.busy} onClick={account.deleteAccount}>
              删除账号
            </button>
          </div>
        </div>
      </details>
    );
  if (!account.google) return null;
  return (
    <button
      className="text-button"
      aria-label="使用 Google 账号登录"
      title="使用 Google 账号登录"
      onClick={account.signIn}
    >
      <LogIn size={17} /> <span className="tool-label">登录</span>
    </button>
  );
}
