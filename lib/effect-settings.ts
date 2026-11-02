import type { BoardEffect } from './presentation';

export type EffectSettings = {
  sound: boolean;
  hints: boolean;
  moveEffects: boolean;
  resultEffects: boolean;
};
export type SettingKey = keyof EffectSettings;
export const EFFECT_SETTINGS_KEY = 'chuhan-effects';
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;
const defaults = (reduced: boolean): EffectSettings => ({
  sound: true,
  hints: true,
  moveEffects: !reduced,
  resultEffects: !reduced,
});
function overrides(raw: string | null): Partial<EffectSettings> {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, value]) =>
          ['hints', 'moveEffects', 'resultEffects'].includes(key) &&
          typeof value === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}
export function loadEffectSettings(
  storage: SettingsStorage | null,
  reduced: boolean,
): EffectSettings {
  const settings = defaults(reduced);
  try {
    settings.sound = storage?.getItem('chuhan-sound') !== 'off';
  } catch {}
  try {
    Object.assign(
      settings,
      overrides(storage?.getItem(EFFECT_SETTINGS_KEY) ?? null),
    );
  } catch {}
  return settings;
}
export function saveEffectSetting(
  storage: SettingsStorage | null,
  key: SettingKey,
  value: boolean,
): void {
  try {
    if (key === 'sound') storage?.setItem('chuhan-sound', value ? 'on' : 'off');
    else
      storage?.setItem(
        EFFECT_SETTINGS_KEY,
        JSON.stringify({
          ...overrides(storage.getItem(EFFECT_SETTINGS_KEY)),
          [key]: value,
        }),
      );
  } catch {}
}
export function visibleEffect(
  effect: BoardEffect | null,
  settings: EffectSettings,
): BoardEffect | null {
  if (!effect) return null;
  return (
    effect.kind === 'capture' || effect.kind === 'check'
      ? settings.moveEffects
      : settings.resultEffects
  )
    ? effect
    : null;
}
