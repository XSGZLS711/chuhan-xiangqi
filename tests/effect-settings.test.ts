import assert from 'node:assert/strict';
import {
  EFFECT_SWITCHES,
  loadEffectSettings,
  saveEffectSetting,
  visibleEffect,
} from '../lib/effect-settings';
import { captureEffect, resultEffect } from '../lib/presentation';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
};
// The other switches are hidden for now: stored values and the system's reduced-motion
// setting are ignored, and everyone runs on the defaults.
assert.deepEqual(EFFECT_SWITCHES, ['sound']);
values.set(
  'chuhan-effects',
  '{"hints":false,"moveEffects":false,"resultEffects":false}',
);
for (const reduced of [false, true]) {
  const hidden = loadEffectSettings(storage, reduced);
  assert.equal(hidden.hints, true);
  assert.equal(hidden.moveEffects, true);
  assert.equal(hidden.resultEffects, true);
}
values.clear();

// The preference machinery stays for the day a settings page shows the switches again.
assert.equal(loadEffectSettings(storage, false, true).moveEffects, true);
assert.equal(loadEffectSettings(storage, true, true).moveEffects, false);
assert.equal(loadEffectSettings(storage, true, true).resultEffects, false);
assert.equal(loadEffectSettings(storage, true, true).hints, true);
saveEffectSetting(storage, 'sound', false);
assert.equal(storage.getItem('chuhan-sound'), 'off');
assert.equal(loadEffectSettings(storage, false, true).sound, false);
saveEffectSetting(storage, 'hints', false);
assert.equal(
  loadEffectSettings(storage, true, true).moveEffects,
  false,
  '提示设置不能覆盖系统的减少动态效果偏好',
);
saveEffectSetting(storage, 'moveEffects', true);
assert.equal(
  loadEffectSettings(storage, true, true).moveEffects,
  true,
  '显式设置优先于默认值',
);
const settings = loadEffectSettings(storage, true, true);
assert.equal(settings.hints, false);
assert(visibleEffect(captureEffect('capture', 'red'), settings));
assert.equal(
  visibleEffect(
    resultEffect({ winner: 'draw', reason: '双方同意和棋' }, 'result'),
    settings,
  ),
  null,
);
assert.equal(visibleEffect(null, settings), null);
values.set('chuhan-effects', '{bad json');
assert.equal(loadEffectSettings(storage, false, true).hints, true);
values.set('chuhan-effects', '{"hints":"no","resultEffects":false}');
assert.equal(loadEffectSettings(storage, false, true).hints, true);
assert.equal(loadEffectSettings(storage, false, true).resultEffects, false);
const blocked = {
  getItem(): string | null {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};
assert.doesNotThrow(() => saveEffectSetting(blocked, 'hints', false));
assert.equal(loadEffectSettings(blocked, true, true).moveEffects, false);
assert.equal(loadEffectSettings(null, false, true).sound, true);
console.log('✓ 效果设置持久化、旧音效偏好、减少动态效果、坏数据及存储不可用');
