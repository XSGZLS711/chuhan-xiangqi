import assert from 'node:assert/strict';
import { nextGameViewport } from '../lib/game-viewport';
import {
  canPlayLive,
  rematchControl,
  recentChat,
  CHAT_BUBBLE_MS,
  displayNotation,
} from '../lib/mobile-game';
import { newRoom, applyAction, type PublicRoom, type Room } from '../lib/game';
import { initialBoard, label, notation } from '../lib/xiangqi';
import { capturedBy } from '../lib/presentation';
let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const now = 100_000;
function fresh() {
  const r = newRoom('mobile-test', { id: 'red', name: '红棋友' }, 0, now);
  applyAction(r, 'black', { action: 'join', name: '黑棋友' }, now);
  return r;
}
function publicRoom(r: Room, you: 'red' | 'black' | null = 'red'): PublicRoom {
  return {
    ...structuredClone(r),
    players: {
      red: { name: '红', online: true },
      black: r.players.black ? { name: '黑', online: true } : null,
    },
    you,
    version: 1,
    serverNow: now,
  };
}

test('红方回合只允许红方操作，黑方点击不会触发走棋', () => {
  const r = fresh();
  assert(canPlayLive(publicRoom(r, 'red'), false));
  assert(!canPlayLive(publicRoom(r, 'black'), false));
  applyAction(r, 'red', { action: 'move', from: 54, to: 45 }, now);
  assert(!canPlayLive(publicRoom(r, 'red'), false));
  assert(canPlayLive(publicRoom(r, 'black'), false));
});
test('等待入座、观战、请求中和终局均忽略棋盘点击', () => {
  const r = fresh();
  assert(!canPlayLive(null, false));
  assert(!canPlayLive(publicRoom(r, null), false));
  assert(!canPlayLive(publicRoom(r), true));
  const waiting = newRoom('waiting', { id: 'red', name: '红' }, 0, now);
  assert(!canPlayLive(publicRoom(waiting), false));
  applyAction(r, 'black', { action: 'resign' }, now);
  assert(!canPlayLive(publicRoom(r), false));
});
test('终局默认显示再来一局', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'resign' }, now);
  assert.deepEqual(rematchControl(publicRoom(r), false), {
    label: '再来一局',
    intent: 'offer',
    disabled: false,
  });
});
test('发出再战邀请后我方等待，对方按钮改为应邀出战', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'offer-rematch' }, now);
  assert.deepEqual(rematchControl(publicRoom(r, 'red'), false), {
    label: '等待应战',
    intent: 'offer',
    disabled: true,
  });
  assert.deepEqual(rematchControl(publicRoom(r, 'black'), false), {
    label: '应邀出战',
    intent: 'accept',
    disabled: false,
  });
});
test('应邀出战接受现有邀请并交换红黑，不发起第二次邀请', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'resign' }, now);
  applyAction(r, 'red', { action: 'offer-rematch' }, now);
  const control = rematchControl(publicRoom(r, 'black'), false);
  assert.equal(control.intent, 'accept');
  applyAction(r, 'black', { action: 'respond', accept: true }, now);
  assert.equal(r.round, 2);
  assert.equal(r.players.red.id, 'black');
  assert.equal(r.result, null);
  assert.equal(r.offer, null);
  assert.deepEqual(r.board, initialBoard());
});
test('撤回或婉拒邀请后按钮恢复再来一局', () => {
  for (const action of ['cancel-offer', 'respond']) {
    const r = fresh();
    applyAction(r, 'red', { action: 'offer-rematch' }, now);
    applyAction(
      r,
      action === 'respond' ? 'black' : 'red',
      { action, accept: false },
      now,
    );
    assert.equal(rematchControl(publicRoom(r), false).label, '再来一局');
    assert.equal(rematchControl(publicRoom(r), false).disabled, false);
  }
});
test('提和不能被再战按钮错误接受，观战者不能应战', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'offer-draw' }, now);
  assert.equal(rematchControl(publicRoom(r, 'black'), false).disabled, true);
  assert.notEqual(
    rematchControl(publicRoom(r, 'black'), false).label,
    '应邀出战',
  );
  r.offer = { kind: 'rematch', side: 'red' };
  assert.equal(rematchControl(publicRoom(r, null), false).disabled, true);
  assert.equal(rematchControl(publicRoom(r, 'black'), true).disabled, true);
});
test('再蒸一下撤回终局并恢复吃掉的棋子和走棋权', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'move', from: 64, to: 1 }, now);
  applyAction(r, 'black', { action: 'resign' }, now);
  assert.equal(capturedBy(r.board, 'red').length, 1);
  applyAction(r, 'black', { action: 'undo' }, now);
  assert.equal(r.result, null);
  assert.equal(r.history.length, 0);
  assert.equal(r.turn, 'red');
  assert.deepEqual(capturedBy(r.board, 'red'), []);
  assert(canPlayLive(publicRoom(r, 'red'), false));
});
test('零步认输也可再蒸一下，不需要重开棋局', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'resign' }, now);
  applyAction(r, 'black', { action: 'undo' }, now);
  assert.equal(r.round, 1);
  assert.equal(r.result, null);
  assert.equal(r.players.red.id, 'red');
});
test('新聊天气泡分别属于发送者头像', () => {
  const r = fresh();
  applyAction(r, 'red', { action: 'chat', text: '好棋' }, now);
  applyAction(r, 'black', { action: 'chat', text: '再来' }, now + 100);
  assert.equal(recentChat(publicRoom(r), 'red', now + 500)?.text, '好棋');
  assert.equal(recentChat(publicRoom(r), 'black', now + 500)?.text, '再来');
});
test('同一方新消息替换旧气泡，另一方保持自己的气泡', () => {
  const r = fresh();
  r.chat = [
    { side: 'red', text: '第一句', at: now },
    { side: 'black', text: '黑方回复', at: now + 200 },
    { side: 'red', text: '第二句', at: now + 1200 },
  ];
  assert.equal(recentChat(publicRoom(r), 'red', now + 1300)?.text, '第二句');
  assert.equal(
    recentChat(publicRoom(r), 'black', now + 1300)?.text,
    '黑方回复',
  );
});
test('气泡十二秒后消失，聊天记录仍保留', () => {
  const r = fresh();
  r.chat = [{ side: 'red', text: '聊天记录', at: now }];
  assert(recentChat(publicRoom(r), 'red', now + CHAT_BUBBLE_MS - 1));
  assert.equal(recentChat(publicRoom(r), 'red', now + CHAT_BUBBLE_MS), null);
  assert.equal(r.chat.length, 1);
  assert.equal(recentChat(publicRoom(r), 'black', now), null);
});
test('刷新不重新弹出过期消息，异常未来时间也不显示', () => {
  const r = fresh();
  r.chat = [{ side: 'red', text: '旧消息', at: now }];
  assert.equal(recentChat(publicRoom(r), 'red', now + 60000), null);
  assert.equal(recentChat(publicRoom(r), 'red', now - 5000), null);
});
test('双方所有车使用車字，新的中文棋谱同时更新', () => {
  const b = initialBoard();
  for (const piece of b.filter((p) => p?.kind === 'r'))
    assert.equal(label(piece!), '車');
  assert(notation(b, 81, 72).startsWith('車'));
});
test('旧棋局的车字棋谱兼容显示，不改原有记录', () => {
  const text = '前车进一';
  assert.equal(displayNotation(text), '前車进一');
  assert.equal(text, '前车进一');
  assert.equal(displayNotation('炮二平五'), '炮二平五');
});
test('打字和键盘平移时棋盘保持原来的高度与位置', () => {
  let layout = nextGameViewport(
    undefined,
    { width: 390, height: 780, top: 0 },
    false,
  );
  layout = nextGameViewport(layout, { width: 390, height: 760, top: 0 }, true);
  layout = nextGameViewport(layout, { width: 390, height: 440, top: 40 }, true);
  assert.equal(layout.height, 780);
  assert.equal(layout.top, 0);
});
test('关闭聊天后等待键盘收起，随后恢复地址栏尺寸适配', () => {
  let layout = nextGameViewport(
    undefined,
    { width: 390, height: 780, top: 0 },
    false,
  );
  layout = nextGameViewport(layout, { width: 390, height: 440, top: 0 }, true);
  layout = nextGameViewport(layout, { width: 390, height: 540, top: 0 }, false);
  assert.equal(layout.height, 780);
  layout = nextGameViewport(layout, { width: 390, height: 780, top: 0 }, false);
  assert.equal(layout.locked, false);
  layout = nextGameViewport(layout, { width: 390, height: 720, top: 0 }, false);
  assert.equal(layout.height, 720);
});
test('横竖屏切换重新适配棋盘，不沿用旧屏幕的高度', () => {
  let layout = nextGameViewport(
    undefined,
    { width: 390, height: 780, top: 0 },
    false,
  );
  layout = nextGameViewport(layout, { width: 390, height: 440, top: 0 }, true);
  layout = nextGameViewport(layout, { width: 844, height: 350, top: 0 }, false);
  assert.equal(layout.height, 350);
  assert.equal(layout.locked, false);
});
console.log(`\n${checks} mobile game checks passed`);
