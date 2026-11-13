import assert from 'node:assert/strict';
import './effect-settings.test';
import {
  cannonScreen,
  dealDelay,
  gallopLeg,
  moveStyle,
  pieceMotion,
} from '../lib/motion';
import {
  capturedBy,
  boardSignature,
  boardTransition,
  branchFeedback,
  checkLines,
  effectDuration,
  updateFeedback,
  resultEffect,
  STAMP_TIMING,
  stampDelay,
  stampDuration,
} from '../lib/presentation';
import {
  initialBoard,
  moveBoard,
  type Board,
  type Kind,
  type Result,
  type Side,
} from '../lib/xiangqi';
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

test('普通走子在滑行后半段开始倾斜放下，两百毫秒落地', () => {
  const timing = pieceMotion();
  assert(timing.slideMs >= 100 && timing.slideMs <= 120);
  // Tipping overlaps the end of the glide; the landing still follows it.
  assert(timing.hoverMs < timing.slideMs && timing.landMs > timing.slideMs);
  assert.equal(timing.landMs - timing.hoverMs, timing.dropMs);
  assert.equal(timing.landMs, 200);
  assert.equal(timing.durationMs, timing.landMs + timing.settleMs);
});
test('吃子仅延长悬停，保持同样的平移与落地节奏', () => {
  const move = pieceMotion(),
    capture = pieceMotion(true);
  assert.equal(capture.slideMs, move.slideMs);
  assert.equal(capture.dropMs, move.dropMs);
  assert(capture.hoverMs > move.hoverMs);
  assert(capture.landMs >= 260 && capture.landMs <= 290);
  assert.equal(capture.durationMs, capture.landMs + capture.settleMs);
});

test('每种棋子各有走法：马踏日、炮翻山、车冲锋，其余滑行', () => {
  // 82 is red's left horse (row 9, file 1); 65 is two ranks up and one file across.
  assert.equal(moveStyle(initial, 82, 65), 'gallop');
  assert.equal(gallopLeg(82, 65), 73);
  // Two ranks forward: the leg is the point ahead; two files across: the point beside.
  assert.equal(gallopLeg(82, 63), 73);
  assert.equal(gallopLeg(82, 75), 83);
  // The red cannon on file 7 takes the black horse over the black cannon.
  assert.equal(moveStyle(initial, 70, 7), 'leap');
  assert.equal(cannonScreen(initial, 70, 7), 25);
  // A cannon that only moves glides; so do short chariot moves.
  assert.equal(moveStyle(initial, 70, 67), 'glide');
  assert.equal(moveStyle(initial, 81, 72), 'glide');
  assert.equal(moveStyle(moveBoard(initial, 54, 45), 81, 63), 'glide');
  assert.equal(moveStyle(moveBoard(initial, 27, 36), 0, 27), 'charge');
  assert.equal(moveStyle(initial, 58, 49), 'glide');
  // Every flight lands after it ends and before the stamp's slowest wait.
  for (const style of ['glide', 'charge', 'gallop', 'leap'] as const)
    for (const capture of [false, true]) {
      const timing = pieceMotion(capture, style);
      assert.equal(timing.landMs, timing.hoverMs + timing.dropMs);
      assert(timing.landMs >= timing.slideMs);
      assert.equal(timing.durationMs, timing.landMs + timing.settleMs);
    }
  // Gallops and leaps finish their flight before the set-down begins.
  assert.equal(
    pieceMotion(false, 'gallop').hoverMs,
    pieceMotion().slideMs + 140,
  );
  assert.equal(
    pieceMotion(true, 'leap').hoverMs,
    pieceMotion(true, 'leap').slideMs,
  );
});
test('开局从河界向外摆子，两边次序相同', () => {
  // Soldiers stand one rank from the river, so the middle soldier is set down first.
  assert.equal(dealDelay(27 + 4), 55);
  assert.equal(
    Math.min(...initial.flatMap((p, n) => (p ? [dealDelay(n)] : []))),
    55,
  );
  assert(dealDelay(54) > dealDelay(58));
  assert(dealDelay(81) > dealDelay(54));
  for (let n = 0; n < 90; n++) assert.equal(dealDelay(n), dealDelay(89 - n));
});
test('将军连线：找出所有将军的子', () => {
  assert.equal(checkLines(initial, 'black'), null);
  // The cannon takes the centre soldier with a black advisor as its screen.
  let b = moveBoard(initial, 70, 67);
  b = moveBoard(b, 3, 13);
  b = moveBoard(b, 67, 31);
  assert.deepEqual(checkLines(b, 'black'), { king: 4, from: [31] });
  assert.equal(checkLines(b, 'red'), null);
});
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
test('吃子触发居中印章，相同版本与聊天不会补播', () => {
  const r = fresh(),
    before = snapshot(r, 1);
  capture(r);
  const after = snapshot(r, 2);
  const effect = updateFeedback(before, after).effect;
  assert.equal(effect?.kind, 'capture');
  assert.equal(effect?.title, '吃');
  assert.equal(effect?.side, 'red');
  assert.equal(updateFeedback(after, snapshot(r, 3)).effect, null);
  assert.equal(updateFeedback(after, after).effect, null);
  assert.equal(
    branchFeedback(initial, 64, 1, 'red', 'branch').effect?.analysis,
    true,
  );
});
test('印章在 250ms 出现，400ms 成形，保留完整淡出时间', () => {
  assert.equal(STAMP_TIMING.delayMs, 250);
  assert.equal(STAMP_TIMING.delayMs + STAMP_TIMING.enterMs, 400);
  assert.equal(STAMP_TIMING.fadeMs, 400);
  assert.equal(stampDuration('capture'), 1400);
  assert.equal(stampDuration('mate'), 1600);
  assert.equal(
    effectDuration('capture'),
    STAMP_TIMING.delayMs + STAMP_TIMING.lateMs + stampDuration('capture'),
  );
  // A stamp waits for the blow: never before 250ms, never before the slowest landing.
  assert.equal(stampDelay(0), 250);
  assert.equal(stampDelay(pieceMotion(true).landMs), 250);
  const vault = pieceMotion(true, 'leap').landMs;
  assert.equal(stampDelay(vault), vault - 20);
  assert(stampDelay(vault) <= STAMP_TIMING.delayMs + STAMP_TIMING.lateMs);
  for (const style of ['glide', 'charge', 'gallop', 'leap'] as const)
    assert(
      pieceMotion(true, style).landMs - 20 <=
        STAMP_TIMING.delayMs + STAMP_TIMING.lateMs,
    );
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
  for (const [result, title] of [
    [{ winner: 'red', reason: '黑方认输' }, '认输'],
    [{ winner: 'black', reason: '超时' }, '超时'],
    [{ winner: 'red', reason: '困毙' }, '困毙'],
    [{ winner: 'black', reason: '长将判负' }, '长将判负'],
    [{ winner: 'draw', reason: '双方同意和棋' }, '和棋'],
  ] as [Result, string][]) {
    const effect = resultEffect(result, 'test');
    assert.equal(effect.kind, 'result');
    // The stamp names the ending; the loser must never see a victory title.
    assert.equal(effect.title, title);
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
test('轮询得到的相同棋盘签名一致，走子后签名改变', () => {
  assert.equal(
    boardSignature(initial),
    boardSignature(structuredClone(initial)),
  );
  assert.notEqual(
    boardSignature(initial),
    boardSignature(moveBoard(initial, 54, 45)),
  );
});
test('悔棋吃子时复活的棋子出现在被吃的位置', () => {
  const captured = moveBoard(initial, 64, 1);
  const t = boardTransition(captured, initial);
  assert(t);
  assert.equal(t.revived?.id, initial[1]!.id);
  assert.equal(t.from, 1);
  assert.equal(t.to, 64);
  assert.equal(boardTransition(initial, captured)?.revived, null);
});
test('同时出现多枚新棋子不虚构复活动画', () => {
  const stripped = initial.slice();
  stripped[1] = null;
  stripped[7] = null;
  assert.equal(boardTransition(stripped, initial), null);
});
const lone = (pieces: [number, Side, Kind][]): Board => {
  const b: Board = Array(90).fill(null);
  pieces.forEach(
    ([n, side, kind]) => (b[n] = { side, kind, id: `${side}${kind}${n}` }),
  );
  return b;
};
test('推演吃子与普通走子分别使用对应音效', () => {
  assert.deepEqual(branchFeedback(initial, 64, 1, 'red', 'a').sounds, [
    'capture',
  ]);
  assert.deepEqual(branchFeedback(initial, 54, 45, 'red', 'a').sounds, [
    'move',
  ]);
  assert.equal(branchFeedback(initial, 54, 45, 'red', 'a').effect, null);
});
test('推演将军标明独立推演，绝杀触发终局音', () => {
  const check = lone([
    [3, 'black', 'k'],
    [86, 'red', 'k'],
    [45, 'red', 'r'],
  ]);
  const f = branchFeedback(check, 45, 48, 'red', 'check');
  assert.deepEqual(f.sounds, ['move', 'check']);
  assert.equal(f.effect?.kind, 'check');
  assert(f.effect?.analysis);
  const mate = lone([
    [3, 'black', 'k'],
    [86, 'red', 'k'],
    [8, 'red', 'r'],
    [45, 'red', 'r'],
  ]);
  const m = branchFeedback(mate, 45, 9, 'red', 'mate');
  assert.deepEqual(m.sounds, ['move', 'mate']);
  assert.equal(m.effect?.title, '绝杀');
  assert.equal(m.effect?.side, 'red');
});
test('将军提示比终局提示短', () => {
  assert(effectDuration('check') < effectDuration('mate'));
  assert.equal(effectDuration('mate'), effectDuration('result'));
});
console.log(`\n${checks} presentation checks passed`);
