import { useRef } from 'react';
import { Check, Languages } from 'lucide-react';
import { LOCALES, localeMeta, type Locale } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';

/** The language menu for page headers: two taps to switch, on any screen size. Every language
 * is named in its own script, so it can be found without reading the current one. */
export default function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  const menu = useRef<HTMLDetailsElement>(null);
  function choose(next: Locale) {
    setLocale(next);
    if (menu.current) menu.current.open = false;
  }
  return (
    <details className="locale-menu" ref={menu}>
      <summary aria-label={t('locale.label')} title={t('locale.label')}>
        <Languages size={17} />
        <span className="tool-label">{localeMeta(locale).name}</span>
      </summary>
      <ul className="locale-panel">
        {LOCALES.map((code) => (
          <li key={code}>
            <button
              lang={localeMeta(code).htmlLang}
              aria-pressed={code === locale}
              onClick={() => choose(code)}
            >
              {localeMeta(code).name}
              {code === locale && <Check size={15} />}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
