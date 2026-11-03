import { useEffect, useState } from 'react';
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
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() =>
    failedSignIn() ? 'Google 登录没有完成，请再试一次。' : '',
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
  async function leave(request: () => Promise<void>, failure: string) {
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
    notice,
    clearNotice: () => setNotice(''),
    signIn: () =>
      location.assign(signInPath(location.pathname + location.search)),
    /** Reloads afterwards so rooms see this browser as anonymous again. */
    signOut: () => leave(signOutAccount, '退出登录没有成功，请再试一次。'),
    deleteAccount: () => {
      if (
        confirm(
          '删除账号后，账号和登录记录会被永久删除，所有设备都会退出登录。本机保存的对局不受影响。确定删除吗？',
        )
      )
        void leave(deleteAccount, '删除账号没有成功，请再试一次。');
    },
  };
}
