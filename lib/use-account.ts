import { useEffect, useState } from 'react';
import type { MessageKey } from './i18n';
import { useLocale } from './use-locale';
import {
  deleteAccount,
  fetchAccount,
  signInPath,
  signOutAccount,
  type AccountStatus,
} from './client-api';

// The server sends people back with ?login=failed when Google sign-in did not finish.
const failedSignIn = () =>
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('login') === 'failed';

export function useAccount() {
  const { t } = useLocale();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // A dictionary key, not a sentence, so a language switch rewrites it in place.
  const [notice, setNotice] = useState<MessageKey | null>(() =>
    failedSignIn() ? 'account.notice.signin' : null,
  );
  useEffect(() => {
    if (failedSignIn()) {
      const url = new URL(location.href);
      url.searchParams.delete('login');
      history.replaceState(
        history.state,
        '',
        url.pathname + url.search + url.hash,
      );
    }
    let live = true;
    fetchAccount()
      .then((value) => live && setStatus(value))
      // Without the account service the page still plays, just without sign-in.
      .catch(() => live && setStatus({ google: false, user: null }));
    return () => {
      live = false;
    };
  }, []);
  async function leave(request: () => Promise<void>, failure: MessageKey) {
    setBusy(true);
    try {
      await request();
      location.reload();
    } catch {
      setBusy(false);
      setNotice(failure);
    }
  }
  return {
    google: status?.google ?? false,
    user: status?.user ?? null,
    busy,
    notice: notice && t(notice),
    clearNotice: () => setNotice(null),
    signIn: () =>
      location.assign(signInPath(location.pathname + location.search)),
    /** Reloads afterwards so rooms see this browser as anonymous again. */
    signOut: () => leave(signOutAccount, 'account.notice.signout'),
    deleteAccount: () => {
      if (confirm(t('account.confirmDelete')))
        void leave(deleteAccount, 'account.notice.delete');
    },
  };
}
