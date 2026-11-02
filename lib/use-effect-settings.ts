import { useSyncExternalStore } from 'react';
import {
  EFFECT_SETTINGS_KEY,
  loadEffectSettings,
  saveEffectSetting,
  type EffectSettings,
  type SettingKey,
} from './effect-settings';

let snapshot: EffectSettings | null = null;
const listeners = new Set<() => void>();
function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function getSnapshot() {
  return (snapshot ??= loadEffectSettings(
    storage(),
    matchMedia('(prefers-reduced-motion: reduce)').matches,
  ));
}
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const reload = () => {
    snapshot = null;
    emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === EFFECT_SETTINGS_KEY ||
      event.key === 'chuhan-sound'
    )
      reload();
  };
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', reload);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', reload);
  };
}
const serverSettings = loadEffectSettings(null, true);
export function useEffectSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSettings,
  );
  function setSetting(key: SettingKey, value: boolean) {
    snapshot = { ...getSnapshot(), [key]: value };
    saveEffectSetting(storage(), key, value);
    emit();
  }
  return { settings, setSetting };
}
