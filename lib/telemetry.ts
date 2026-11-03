import type { ReportKind } from '../worker/client-error';
import { loadLocale, localeMeta } from './i18n';

// Error reports and the page-load count. Both are same-origin POSTs sent without cookies
// (credentials: 'omit'), so they work on the cross-origin-isolated /ai/ page and carry nothing
// that tells one player from another. The Worker logs them (worker/client-error.ts,
// worker/visit.ts); nothing is stored.

/** Reports one page load sends at most, however often the same error recurs. */
const REPORTS_PER_PAGE = 5;
const sent = new Set<string>();

/** Query strings and fragments name rooms and games: keep them out of what is reported. */
export const withoutQueries = (text: string) =>
  text.replace(/(\b[a-z][\w+.-]*:\/\/[^\s?#)'"]*)[?#][^\s)'"]*/gi, '$1');

export type ErrorReport = {
  kind: ReportKind;
  message: string;
  stack?: string;
  code?: string;
  page: string;
  lang?: string;
  ui?: string;
};

/** What is sent about `error`: its message and stack, the code of an `AppError`, the page
 * path and the languages. */
export function errorReport(
  kind: ReportKind,
  error: unknown,
  where: { page: string; lang?: string; ui?: string },
): ErrorReport {
  const known = error instanceof Error;
  const code = known ? (error as Error & { code?: unknown }).code : undefined;
  return {
    kind,
    message: withoutQueries(
      known ? `${error.name}: ${error.message}` : String(error),
    ).slice(0, 500),
    stack:
      known && error.stack
        ? withoutQueries(error.stack).slice(0, 4000)
        : undefined,
    code: typeof code === 'string' ? code : undefined,
    page: where.page,
    lang: where.lang,
    ui: where.ui,
  };
}

function post(path: string, body: unknown) {
  // keepalive lets a report leave even when the page is closing.
  void fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}

const here = () => ({
  page: location.pathname,
  lang: navigator.language,
  ui: document.documentElement.lang,
});

/** Sends one report, once per distinct error, up to the page's cap. */
export function reportClientError(kind: ReportKind, error: unknown) {
  if (navigator.webdriver || sent.size >= REPORTS_PER_PAGE) return;
  const report = errorReport(kind, error, here());
  const key = `${report.kind}\n${report.message}\n${report.stack?.split('\n', 2)[1] ?? ''}`;
  if (sent.has(key)) return;
  sent.add(key);
  post('/api/client-error', report);
}

/** Where this load came from: another site's hostname, "self" from inside the site, "" when
 * typed or bookmarked. Never the full address. */
function cameFrom(): string {
  try {
    const from = new URL(document.referrer);
    return from.origin === location.origin ? 'self' : from.hostname;
  } catch {
    return '';
  }
}

/** Catches what the page did not, and counts this load once. Automated browsers (crawlers,
 * the test suites) are left out. */
export function startTelemetry(entry: 'home' | 'ai') {
  if (navigator.webdriver) return;
  window.addEventListener('error', (event) =>
    reportClientError('error', event.error ?? event.message),
  );
  window.addEventListener('unhandledrejection', (event) =>
    reportClientError('rejection', event.reason),
  );
  const query = new URLSearchParams(location.search);
  const page =
    entry === 'ai'
      ? query.has('game')
        ? 'review'
        : 'ai'
      : query.has('room')
        ? 'room'
        : 'home';
  // Sent before the first render sets <html lang>: the language the page is about to pick.
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {}
  post('/api/visit', {
    page,
    from: cameFrom(),
    lang: navigator.language,
    ui: localeMeta(loadLocale(storage, navigator.languages)).htmlLang,
    touch: matchMedia('(pointer: coarse)').matches,
  });
}
