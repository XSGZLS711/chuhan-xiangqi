import { useRef } from 'react';
import { Check, Languages } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
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

/** The other languages as menu items, for the phone's game menu. */
export function LocaleMenuItems() {
  const { locale, setLocale } = useLocale();
  return LOCALES.filter((code) => code !== locale).map((code) => (
    <DropdownMenuItem
      key={code}
      lang={localeMeta(code).htmlLang}
      onClick={() => setLocale(code)}
    >
      <Languages />
      <span>{localeMeta(code).name}</span>
    </DropdownMenuItem>
  ));
}
