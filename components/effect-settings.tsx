import { SlidersHorizontal } from 'lucide-react';
import type {
  EffectSettings as Settings,
  SettingKey,
} from '@/lib/effect-settings';

const labels: [SettingKey, string][] = [
  ['sound', '音效'],
  ['hints', '走子提示'],
  ['moveEffects', '吃子/将军动画'],
  ['resultEffects', '绝杀/结算动画'],
];
export default function EffectSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (key: SettingKey, value: boolean) => void;
}) {
  return (
    <details className="effect-settings">
      <summary aria-label="对局设置" title="对局设置">
        <SlidersHorizontal size={17} />
      </summary>
      <fieldset>
        <legend className="sr-only">对局设置</legend>
        <p className="effect-settings-title" aria-hidden="true">
          对局设置
        </p>
        {labels.map(([key, text]) => (
          <label key={key}>
            <span>{text}</span>
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
