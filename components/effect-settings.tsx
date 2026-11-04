import { SlidersHorizontal } from 'lucide-react';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import type { MessageKey } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import type {
  EffectSettings as Settings,
  SettingKey,
} from '@/lib/effect-settings';

const labels: [SettingKey, MessageKey][] = [
  ['sound', 'fx.sound'],
  ['hints', 'fx.hints'],
  ['moveEffects', 'fx.moveEffects'],
  ['resultEffects', 'fx.resultEffects'],
];
export default function EffectSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (key: SettingKey, value: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <details className="effect-settings">
      <summary aria-label={t('fx.title')} title={t('fx.title')}>
        <SlidersHorizontal size={17} />
      </summary>
      <fieldset>
        <legend className="sr-only">{t('fx.title')}</legend>
        <p className="effect-settings-title" aria-hidden="true">
          {t('fx.title')}
        </p>
        {labels.map(([key, text]) => (
          <label key={key}>
            <span>{t(text)}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) => onChange(key, event.target.checked)}
            />
          </label>
        ))}
      </fieldset>
    </details>
  );
}

/** The same switches as menu items, for the phone's game menu: the board has no button there. */
export function EffectMenuItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (key: SettingKey, value: boolean) => void;
}) {
  const { t } = useLocale();
  return labels
    .filter(([key]) => key !== 'sound')
    .map(([key, text]) => (
      <DropdownMenuCheckboxItem
        key={key}
        checked={settings[key]}
        onCheckedChange={(value) => onChange(key, value)}
      >
        {t(text)}
      </DropdownMenuCheckboxItem>
    ));
}
