import { LogIn, LogOut } from 'lucide-react';
import { FEEDBACK_ADDRESS, PRIVACY_PAGE } from '@/components/site-links';
import { localeMeta, playerName } from '@/lib/i18n';
import type { useAccount } from '@/lib/use-account';
import { useLocale } from '@/lib/use-locale';

// The first character as people see it, even for an emoji or a combined glyph.
const initial = (name: string, language: string, fallback: string) =>
  new Intl.Segmenter(language, { granularity: 'grapheme' })
    .segment(name)
    [Symbol.iterator]()
    .next().value?.segment ?? fallback;

/** Google sign-in in the page header. Nothing shows until sign-in is configured. */
export default function AccountMenu({
  account,
}: {
  account: ReturnType<typeof useAccount>;
}) {
  const { locale, t } = useLocale();
  const { user } = account;
  if (user) {
    const name = playerName(locale, user.name);
    return (
      <details className="account-menu">
        <summary aria-label={t('account.label', { name })} title={name}>
          <span aria-hidden="true">
            {initial(name, localeMeta(locale).intl, t('account.initial'))}
          </span>
        </summary>
        <div className="account-panel">
          <strong>{name}</strong>
          {user.email && <small>{user.email}</small>}
          <button
            className="secondary-button"
            disabled={account.busy}
            onClick={() => void account.signOut()}
          >
            <LogOut size={15} />
            {account.busy ? t('account.wait') : t('account.signOut')}
          </button>
          <div className="account-links">
            <a href={PRIVACY_PAGE}>{t('account.privacy')}</a>
            <a href={`mailto:${FEEDBACK_ADDRESS}`} title={FEEDBACK_ADDRESS}>
              {t('account.feedback')}
            </a>
            <button disabled={account.busy} onClick={account.deleteAccount}>
              {t('account.delete')}
            </button>
          </div>
        </div>
      </details>
    );
  }
  if (!account.google) return null;
  return (
    <button
      className="text-button"
      aria-label={t('account.signIn.label')}
      title={t('account.signIn.label')}
      onClick={account.signIn}
    >
      <LogIn size={17} />{' '}
      <span className="tool-label">{t('account.signIn')}</span>
    </button>
  );
}
