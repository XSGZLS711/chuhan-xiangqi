import assert from 'node:assert/strict';
import {
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
assert.equal(loadEffectSettings(storage, false).moveEffects, true);
assert.equal(loadEffectSettings(storage, true).moveEffects, false);
assert.equal(loadEffectSettings(storage, true).resultEffects, false);
assert.equal(loadEffectSettings(storage, true).hints, true);
saveEffectSetting(storage, 'sound', false);
assert.equal(storage.getItem('chuhan-sound'), 'off');
assert.equal(loadEffectSettings(storage, false).sound, false);
saveEffectSetting(storage, 'hints', false);
assert.equal(
  loadEffectSettings(storage, true).moveEffects,
  false,
  '提示设置不能覆盖系统的减少动态效果偏好',
);
saveEffectSetting(storage, 'moveEffects', true);
assert.equal(
  loadEffectSettings(storage, true).moveEffects,
  true,
  '显式设置优先于默认值',
);
const settings = loadEffectSettings(storage, true);
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
assert.equal(loadEffectSettings(storage, false).hints, true);
values.set('chuhan-effects', '{"hints":"no","resultEffects":false}');
assert.equal(loadEffectSettings(storage, false).hints, true);
assert.equal(loadEffectSettings(storage, false).resultEffects, false);
const blocked = {
  getItem(): string | null {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};
assert.doesNotThrow(() => saveEffectSetting(blocked, 'hints', false));
assert.equal(loadEffectSettings(blocked, true).moveEffects, false);
assert.equal(loadEffectSettings(null, false).sound, true);
console.log('✓ 效果设置持久化、旧音效偏好、减少动态效果、坏数据及存储不可用');
