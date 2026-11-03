import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeMeta,
  notationFor,
  saveLocale,
  t as translate,
  tn as translatePlural,
  type Locale,
  type MessageKey,
  type Params,
  type PluralKey,
} from './i18n';
import type { NotationStyle } from './notation';

export type Translate = (key: MessageKey, params?: Params) => string;
export type TranslatePlural = (
  key: PluralKey,
  count: number,
  params?: Params,
) => string;
export type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  tn: TranslatePlural;
  /** How moves are written in this locale. */
  notation: NotationStyle;
};
const bind = (
  locale: Locale,
  setLocale: (locale: Locale) => void,
): LocaleState => ({
  locale,
  setLocale,
  t: (key, params) => translate(locale, key, params),
  tn: (key, count, params) => translatePlural(locale, key, count, params),
  notation: notationFor(locale),
});
// Without a provider (tests, server rendering) the interface is Chinese, as it always was.
const Context = createContext<LocaleState>(bind('zh', () => {}));

/** The current locale and `t` bound to it. Switching re-renders in place: nothing reloads. */
export const useLocale = () => useContext(Context);

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const languages = () =>
  typeof navigator === 'undefined' ? undefined : navigator.languages;

/** Both entry points share one saved choice. `page` picks the title and description. */
export function LocaleProvider({
  page,
  initialLocale,
  children,
}: {
  page: 'home' | 'ai';
  /** Skips the saved choice and the browser's language, for tests. */
  initialLocale?: Locale;
  children?: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? loadLocale(storage(), languages()),
  );
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    saveLocale(storage(), next);
  }, []);
  // Another tab, or the other entry point, changed the language.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === LOCALE_STORAGE_KEY)
        setLocaleState(loadLocale(storage(), languages()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  // The static pages are Chinese; the rest follows the choice at run time.
  useEffect(() => {
    document.documentElement.lang = localeMeta(locale).htmlLang;
    const kind = page === 'ai' ? 'ai' : 'home';
    document.title = translate(locale, `meta.${kind}.title`);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(locale, `meta.${kind}.description`));
  }, [locale, page]);
  const value = useMemo(() => bind(locale, setLocale), [locale, setLocale]);
  return createElement(Context.Provider, { value }, children);
}
