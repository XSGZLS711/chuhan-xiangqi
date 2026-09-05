import assert from 'node:assert/strict';
import {
  capturedBy,
  boardTransition,
  updateFeedback,
  resultEffect,
} from '../lib/presentation';
import { initialBoard, moveBoard, type Result } from '../lib/xiangqi';
import { newRoom, applyAction, type Room, type PublicRoom } from '../lib/game';

let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const now = 100_000;
const fresh = () => {
  const r = newRoom('ui-test', { id: 'red', name: '红棋友' }, 0, now);
  applyAction(r, 'black', { action: 'join', name: '黑棋友' }, now);
  return r;
};
const snapshot = (r: Room, version: number): PublicRoom => ({
  ...structuredClone(r),
  players: {
    red: { name: '红棋友', online: true },
    black: { name: '黑棋友', online: true },
  },
  you: 'red',
  version,
  serverNow: now,
});
const capture = (r: Room) =>
  applyAction(r, 'red', { action: 'move', from: 64, to: 1 }, now);
const initial = initialBoard();

test('开局双方吃子栏为空', () => {
  assert.deepEqual(capturedBy(initial, 'red'), []);
  assert.deepEqual(capturedBy(initial, 'black'), []);
});
test('红方吃黑马，只计入红方吃子栏', () => {
  const r = fresh();
  capture(r);
  const groups = capturedBy(r.board, 'red');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].piece.kind, 'h');
  assert.equal(groups[0].piece.side, 'black');
  assert.equal(groups[0].count, 1);
  assert.deepEqual(capturedBy(r.board, 'black'), []);
});
test('双方连续吃子各自记录，不按棋盘朝向混淆', () => {
  const r = fresh();
  capture(r);
  applyAction(r, 'black', { action: 'move', from: 0, to: 1 }, now);
  assert.equal(capturedBy(r.board, 'black')[0].piece.kind, 'c');
  assert.equal(capturedBy(r.board, 'black')[0].piece.side, 'red');
  assert.equal(capturedBy(r.board, 'red')[0].piece.kind, 'h');
});
test('同类棋子合并计数并按车马炮顺序展示', () => {
  const b = initial.slice();
  [0, 1, 7, 19].forEach((n) => (b[n] = null));
  assert.deepEqual(
    capturedBy(b, 'red').map((g) => [g.piece.kind, g.count]),
    [
      ['r', 1],
      ['h', 2],
      ['c', 1],
    ],
  );
});
test('无限悔棋同步还原吃子栏', () => {
  const r = fresh();
  for (let n = 0; n < 15; n++) {
    capture(r);
    assert.equal(capturedBy(r.board, 'red')[0].count, 1);
    applyAction(r, 'black', { action: 'undo' }, now);
    assert.deepEqual(capturedBy(r.board, 'red'), []);
  }
});
test('复盘或推演只统计展示中的棋盘', () => {
  const r = fresh();
  capture(r);
  assert.deepEqual(capturedBy(r.history[0].before, 'red'), []);
  assert.equal(capturedBy(r.board, 'red')[0].count, 1);
  const branch = moveBoard(initial, 70, 7);
  assert.equal(capturedBy(branch, 'red')[0].count, 1);
  assert.deepEqual(capturedBy(initial, 'red'), []);
});
test('走棋过渡保留棋子身份与起终坐标', () => {
  const t = boardTransition(initial, moveBoard(initial, 54, 45));
  assert(t);
  assert.equal(t.piece.id, initial[54]!.id);
  assert.equal(t.from, 54);
  assert.equal(t.to, 45);
  assert.equal(t.captured, null);
});
test('吃子过渡包含消失棋子', () => {
  const t = boardTransition(initial, moveBoard(initial, 64, 1));
  assert.equal(t?.captured?.id, initial[1]!.id);
  assert.equal(t?.piece.id, initial[64]!.id);
});
test('悔棋复活棋子时不会反向播放吃子效果', () => {
  assert.equal(
    boardTransition(moveBoard(initial, 64, 1), initial)?.captured,
    null,
  );
});
test('相同棋盘与多步重连不虚构单步动画', () => {
  assert.equal(boardTransition(initial, structuredClone(initial)), null);
  const changed = moveBoard(moveBoard(initial, 54, 45), 27, 36);
  assert.equal(boardTransition(initial, changed), null);
});
test('首次进入房间不会补播旧走棋或绝杀', () => {
  const r = fresh();
  capture(r);
  r.result = { winner: 'red', reason: '将死' };
  assert.deepEqual(updateFeedback(null, snapshot(r, 5)), {
    sounds: [],
    effect: null,
    reset: true,
  });
});
test('双方看到新吃子时只触发一次吃子音', () => {
  const r = fresh(),
    before = snapshot(r, 1);
  capture(r);
  const after = snapshot(r, 2);
  for (const you of ['red', 'black', null] as const) {
    assert.deepEqual(
      updateFeedback({ ...before, you }, { ...after, you }).sounds,
      ['capture'],
    );
  }
  assert.deepEqual(updateFeedback(after, structuredClone(after)).sounds, []);
});
test('普通落子与吃子使用不同音效', () => {
  const r = fresh(),
    before = snapshot(r, 1);
  applyAction(r, 'red', { action: 'move', from: 54, to: 45 }, now);
  assert.deepEqual(updateFeedback(before, snapshot(r, 2)).sounds, ['move']);
});
test('聊天与在线状态更新不重复播放音效', () => {
  const r = fresh();
  capture(r);
  const before = snapshot(r, 2);
  applyAction(r, 'red', { action: 'chat', text: '好棋' }, now);
  assert.deepEqual(updateFeedback(before, snapshot(r, 3)).sounds, []);
});
test('将军单独提示正确应将方', () => {
  const r = fresh(),
    before = snapshot(r, 1);
  capture(r);
  r.history[0].check = true;
  const feedback = updateFeedback(before, snapshot(r, 2));
  assert.deepEqual(feedback.sounds, ['capture', 'check']);
  assert.equal(feedback.effect?.title, '将军');
  assert.equal(feedback.effect?.detail, '黑方应将');
});
test('真正将死触发绝杀且不叠加将军提示', () => {
  const r = fresh(),
    before = snapshot(r, 1);
  capture(r);
  r.history[0].check = true;
  r.result = { winner: 'red', reason: '将死' };
  const f = updateFeedback(before, snapshot(r, 2));
  assert.deepEqual(f.sounds, ['capture', 'mate']);
  assert.equal(f.effect?.title, '绝杀');
  assert.equal(f.effect?.side, 'red');
});
test('认输、超时、困毙与和棋不会误显示绝杀', () => {
  for (const result of [
    { winner: 'red', reason: '黑方认输' },
    { winner: 'black', reason: '超时' },
    { winner: 'red', reason: '困毙' },
    { winner: 'draw', reason: '双方同意和棋' },
  ] as Result[]) {
    const effect = resultEffect(result, 'test');
    assert.equal(effect.kind, 'result');
    assert.notEqual(effect.title, '绝杀');
    assert(effect.detail.includes(result.reason));
  }
});
test('终局后轮询与消息不会重复终局动画', () => {
  const r = fresh();
  r.result = { winner: 'draw', reason: '双方同意和棋' };
  assert.deepEqual(updateFeedback(snapshot(r, 2), snapshot(r, 3)).sounds, []);
  assert.equal(updateFeedback(snapshot(r, 2), snapshot(r, 3)).effect, null);
});
test('终局悔棋会清除终局动画和吃子效果', () => {
  const r = fresh();
  capture(r);
  r.result = { winner: 'black', reason: '红方认输' };
  const before = snapshot(r, 3);
  applyAction(r, 'black', { action: 'undo' }, now);
  assert.deepEqual(updateFeedback(before, snapshot(r, 4)), {
    sounds: ['undo'],
    effect: null,
    reset: true,
  });
});
test('零步撤回认输同样清除终局提示', () => {
  const r = fresh();
  r.result = { winner: 'black', reason: '红方认输' };
  const before = snapshot(r, 2);
  applyAction(r, 'red', { action: 'undo' }, now);
  assert.equal(updateFeedback(before, snapshot(r, 3)).reset, true);
});
test('重开换色后不误播悔棋且吃子栏清空', () => {
  const r = fresh();
  capture(r);
  const before = snapshot(r, 2);
  applyAction(r, 'red', { action: 'offer-rematch' }, now);
  applyAction(r, 'black', { action: 'respond', accept: true }, now);
  assert.deepEqual(updateFeedback(before, snapshot(r, 4)), {
    sounds: [],
    effect: null,
    reset: true,
  });
  assert.deepEqual(capturedBy(r.board, 'red'), []);
  assert.deepEqual(capturedBy(r.board, 'black'), []);
});
test('推演绝杀明确标记独立推演', () => {
  const f = resultEffect({ winner: 'black', reason: '将死' }, 'branch', true);
  assert(f.analysis);
  assert(f.detail.startsWith('推演 · '));
});
console.log(`\n${checks} presentation checks passed`);
