import { useLocale } from '@/lib/use-locale';

// A static page in public/, outside the React app.
export const PRIVACY_PAGE = '/privacy';
// Cloudflare Email Routing forwards this address to the owner.
export const FEEDBACK_ADDRESS = 'feedback@chuhanxiangqi.com';

/** The privacy page and the feedback address at the foot of the lobby, where everyone sees
 * them: the account menu only opens for people who are signed in. */
export default function SiteLinks() {
  const { t } = useLocale();
  return (
    <p className="site-links">
      <a href={PRIVACY_PAGE}>{t('account.privacy')}</a>
      <a href={`mailto:${FEEDBACK_ADDRESS}`} title={FEEDBACK_ADDRESS}>
        {t('account.feedback')}
      </a>
    </p>
  );
}
