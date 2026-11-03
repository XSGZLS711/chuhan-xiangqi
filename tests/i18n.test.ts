import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EffectSettings from '../components/effect-settings';
import GameRecord from '../components/game-record';
import { engineMove } from '../lib/ai-game';
import {
  archiveGame,
  archiveLabel,
  parseArchive,
  replayArchive,
} from '../lib/archive';
import { AppError, errorBody, errorInfo, errorText } from '../lib/errors';
import { explainMove } from '../lib/explain';
import {
  analyseMove,
  ratingLabel,
  type AnalysisScore,
} from '../lib/game-analysis';
import { applyAction, GameError, newRoom, type Room } from '../lib/game';
import {
  detectLocale,
  formatDateTime,
  hasMessage,
  loadLocale,
  LOCALES,
  LOCALE_STORAGE_KEY,
  playerName,
  reasonText,
  saveLocale,
  t,
  tn,
  type MessageKey,
} from '../lib/i18n';
import { en } from '../lib/locales/en';
import { zh } from '../lib/locales/zh';
import { historyMoveText, moveText, wxfNotation } from '../lib/notation';
import { resultEffect, stampWords, updateFeedback } from '../lib/presentation';
import { noteText } from '../lib/room-note';
import { scoreText } from '../lib/review';
import { NAME, REASON } from '../lib/tokens';
import { LocaleProvider } from '../lib/use-locale';
import { apiError } from '../lib/client-api';
import {
  initialBoard,
  label,
  moveBoard,
  notation,
  legalTargets,
  type Board,
  type Kind,
  type Move,
  type Piece,
  type Side,
} from '../lib/xiangqi';

let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const CJK = /[㐀-鿿＀-￯　-〿]/;
const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(zh.messages) as MessageKey[];

test('每种语言的词典与中文有同一组键，占位符一一对应', () => {
  assert.deepEqual(Object.keys(en.messages).sort(), [...keys].sort());
  for (const key of keys)
    assert.deepEqual(
      placeholders(en.messages[key]),
      placeholders(zh.messages[key]),
      `${key} 的 {参数} 在两种语言里不一致`,
    );
});
test('单复数键成对出现，并且各语言齐全', () => {
  const others = keys.filter((key) => key.endsWith('.other'));
  assert(others.length >= 5);
  for (const key of others)
    assert(hasMessage(key.replace(/\.other$/, '.one')), key);
  assert.equal(tn('en', 'recent.moves', 1), '1 move');
  assert.equal(tn('en', 'recent.moves', 2), '2 moves');
  assert.equal(tn('zh', 'recent.moves', 1), '1 步');
  assert.equal(tn('zh', 'recent.moves', 26), '26 步');
});
test('英文词典里没有中文字符（语言名在 meta 里，不算）', () => {
  for (const [key, text] of Object.entries(en.messages))
    assert(!CJK.test(text), `${key}: ${text}`);
  assert.equal(en.meta.name, 'English');
  assert.equal(zh.meta.name, '中文');
});
test('t：占位符替换，缺参数时原样保留', () => {
  assert.equal(t('en', 'room.round', { n: 3 }), 'Game 3');
  assert.equal(t('zh', 'room.round', { n: 3 }), '第 3 局');
  assert.equal(t('en', 'room.round'), 'Game {n}');
  assert.equal(t('zh', 'room.pill.toMove', { side: '红方' }), '红方走棋');
});
test('棋子名与 xiangqi.label 一致，两种语言都有', () => {
  const sides: Side[] = ['red', 'black'];
  const kinds: Kind[] = ['k', 'a', 'e', 'h', 'r', 'c', 'p'];
  for (const side of sides)
    for (const kind of kinds) {
      const piece = { side, kind, id: 'x' } satisfies Piece;
      assert.equal(
        t('zh', `piece.${side}.${kind}` as MessageKey),
        label(piece),
      );
      assert(t('en', `piece.${side}.${kind}` as MessageKey).length > 2);
    }
});

test('语言选择：zh 开头读中文，其余读英文，存下来的优先，存储坏了不影响', () => {
  assert.equal(detectLocale(['zh-CN', 'en']), 'zh');
  assert.equal(detectLocale(['zh-Hant-TW']), 'zh');
  assert.equal(detectLocale(['zh']), 'zh');
  assert.equal(detectLocale(['en-US', 'zh-CN']), 'en');
  assert.equal(detectLocale(['vi']), 'en');
  assert.equal(detectLocale([]), 'en');
  assert.equal(detectLocale(undefined), 'en');
  const store = (value: string | null) => ({ getItem: () => value });
  assert.equal(loadLocale(store('zh'), ['en']), 'zh');
  assert.equal(loadLocale(store('en'), ['zh-CN']), 'en');
  assert.equal(loadLocale(store('fr'), ['zh-CN']), 'zh');
  assert.equal(loadLocale(store(null), ['en-GB']), 'en');
  assert.equal(
    loadLocale(
      {
        getItem: () => {
          throw new Error('blocked');
        },
      },
      ['zh-CN'],
    ),
    'zh',
  );
  assert.equal(loadLocale(null, ['en']), 'en');
  const written: string[] = [];
  saveLocale({ setItem: (key, value) => written.push(key, value) }, 'en');
  assert.deepEqual(written, [LOCALE_STORAGE_KEY, 'en']);
  assert.doesNotThrow(() =>
    saveLocale(
      {
        setItem: () => {
          throw new Error('full');
        },
      },
      'zh',
    ),
  );
  assert.deepEqual([...LOCALES], ['zh', 'en']);
});

// ---- WXF notation ----
const at = (square: string) => engineMove(square + square)!.from;
const mk = (pieces: [Side, Kind, string][]): Board => {
  const board: Board = Array(90).fill(null);
  pieces.forEach(([side, kind, square], i) => {
    board[at(square)] = { side, kind, id: `${side}-${kind}-${i}` };
  });
  return board;
};
const wxf = (board: Board, from: string, to: string) =>
  wxfNotation(board, at(from), at(to));

test('WXF：开局的常见着法（炮二平五、马二进三、马8进7 …）', () => {
  const start = initialBoard();
  assert.equal(wxf(start, 'h3', 'e3'), 'C2=5');
  assert.equal(wxf(start, 'h1', 'g3'), 'H2+3');
  assert.equal(wxf(start, 'b1', 'c3'), 'H8+7');
  assert.equal(wxf(start, 'h10', 'g8'), 'H8+7');
  assert.equal(wxf(start, 'b3', 'e3'), 'C8=5');
  assert.equal(wxf(start, 'b8', 'e8'), 'C2=5');
  assert.equal(wxf(start, 'i1', 'i2'), 'R1+1');
  assert.equal(wxf(start, 'a1', 'a2'), 'R9+1');
  assert.equal(wxf(start, 'g4', 'g5'), 'P3+1');
  assert.equal(wxf(start, 'c7', 'c6'), 'P3+1');
});
test('WXF：一盘棋的前几步按序记谱', () => {
  const moves = ['h3e3', 'h10g8', 'h1g3', 'i10h10', 'i1h1', 'b8e8'];
  const expected = ['C2=5', 'H8+7', 'H2+3', 'R9=8', 'R1=2', 'C2=5'];
  let board = initialBoard();
  const got = moves.map((token) => {
    const { from, to } = engineMove(token)!;
    const text = wxfNotation(board, from, to);
    board = moveBoard(board, from, to);
    return text;
  });
  assert.deepEqual(got, expected);
});
test('WXF：后退、平移、象仕将兵的落点用路数，车炮兵用步数', () => {
  assert.equal(wxf(mk([['red', 'r', 'a2']]), 'a2', 'a1'), 'R9-1');
  assert.equal(wxf(mk([['red', 'r', 'a2']]), 'a2', 'i2'), 'R9=1');
  assert.equal(wxf(mk([['red', 'e', 'c1']]), 'c1', 'e3'), 'E7+5');
  assert.equal(wxf(mk([['red', 'e', 'e3']]), 'e3', 'c1'), 'E5-7');
  assert.equal(wxf(mk([['red', 'a', 'd1']]), 'd1', 'e2'), 'A6+5');
  assert.equal(wxf(mk([['red', 'k', 'e1']]), 'e1', 'e2'), 'K5+1');
  assert.equal(wxf(mk([['red', 'k', 'e1']]), 'e1', 'd1'), 'K5=6');
  assert.equal(wxf(mk([['red', 'p', 'c4']]), 'c4', 'c5'), 'P7+1');
  assert.equal(wxf(mk([['red', 'p', 'e6']]), 'e6', 'd6'), 'P5=6');
  assert.equal(wxf(mk([['red', 'c', 'b3']]), 'b3', 'b10'), 'C8+7');
  assert.equal(wxf(mk([['black', 'p', 'c7']]), 'c7', 'c6'), 'P3+1');
  assert.equal(wxf(mk([['black', 'p', 'i5']]), 'i5', 'h5'), 'P9=8');
  assert.equal(wxf(mk([['black', 'k', 'e10']]), 'e10', 'e9'), 'K5+1');
  assert.equal(wxf(mk([['black', 'h', 'h8']]), 'h8', 'g10'), 'H8-7');
  assert.equal(wxf(mk([['black', 'c', 'h8']]), 'h8', 'h3'), 'C8+5');
});
test('WXF：同一路两个同种棋子，前者记 +，后者记 -（红黑方向相反）', () => {
  const red = mk([
    ['red', 'r', 'a3'],
    ['red', 'r', 'a5'],
  ]);
  assert.equal(wxf(red, 'a5', 'a7'), '+R+2');
  assert.equal(wxf(red, 'a3', 'a4'), '-R+1');
  assert.equal(wxf(red, 'a3', 'b3'), '-R=8');
  const black = mk([
    ['black', 'r', 'a8'],
    ['black', 'r', 'a6'],
  ]);
  // Black's front piece is the one nearer red's side, the larger row.
  assert.equal(wxf(black, 'a6', 'a5'), '+R+1');
  assert.equal(wxf(black, 'a8', 'b8'), '-R=2');
  const horses = mk([
    ['red', 'h', 'c3'],
    ['red', 'h', 'c5'],
  ]);
  assert.equal(wxf(horses, 'c5', 'd7'), '+H+6');
  assert.equal(wxf(horses, 'c3', 'e4'), '-H+5');
  const advisors = mk([
    ['red', 'a', 'e1'],
    ['red', 'a', 'e3'],
  ]);
  assert.equal(wxf(advisors, 'e3', 'd4'), '+A+6');
  assert.equal(wxf(advisors, 'e1', 'd2'), '-A+6');
});
test('WXF：一路三个以上的兵，前 +、后 -，中间的从前往后数', () => {
  const three = mk([
    ['red', 'p', 'e5'],
    ['red', 'p', 'e6'],
    ['red', 'p', 'e7'],
  ]);
  assert.equal(wxf(three, 'e7', 'e8'), '+P+1');
  assert.equal(wxf(three, 'e6', 'd6'), '2P=6');
  assert.equal(wxf(three, 'e5', 'f5'), '-P=4');
  const five = mk(
    (['c4', 'c5', 'c6', 'c7', 'c8'] as const).map(
      (square): [Side, Kind, string] => ['red', 'p', square],
    ),
  );
  assert.equal(wxf(five, 'c8', 'c9'), '+P+1');
  assert.equal(wxf(five, 'c7', 'b7'), '2P=8');
  assert.equal(wxf(five, 'c6', 'b6'), '3P=8');
  assert.equal(wxf(five, 'c5', 'b5'), '4P=8');
  assert.equal(wxf(five, 'c4', 'b4'), '-P=8');
  const black = mk([
    ['black', 'p', 'e6'],
    ['black', 'p', 'e5'],
    ['black', 'p', 'e4'],
  ]);
  assert.equal(wxf(black, 'e4', 'e3'), '+P+1');
  assert.equal(wxf(black, 'e5', 'd5'), '2P=4');
  assert.equal(wxf(black, 'e6', 'f6'), '-P=6');
  const pair = mk([
    ['red', 'p', 'e6'],
    ['red', 'p', 'e7'],
  ]);
  assert.equal(wxf(pair, 'e7', 'e8'), '+P+1');
  assert.equal(wxf(pair, 'e6', 'e7'), '-P+1');
});
test('WXF：吃子不改变记谱；moveText 的中文分支就是原来的 notation', () => {
  const board = mk([
    ['red', 'c', 'b3'],
    ['black', 'p', 'b7'],
    ['black', 'h', 'b9'],
  ]);
  assert.equal(wxf(board, 'b3', 'b7'), 'C8+4');
  const start = initialBoard();
  for (const [from, to] of [
    [70, 67],
    [88, 69],
    [7, 24],
    [89, 80],
  ])
    assert.equal(
      moveText(start, from, to, 'chinese'),
      notation(start, from, to),
    );
});
test('WXF：随机对局里每一步都有唯一的记谱，并能还原成那一步', () => {
  // The only ambiguity is two files that each hold two of the same piece, which the
  // notation (like the Chinese one) does not tell apart.
  let seed = 11;
  const random = () =>
    (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let compared = 0;
  for (let game = 0; game < 12; game++) {
    let board = initialBoard();
    let side: Side = 'red';
    for (let ply = 0; ply < 80; ply++) {
      const moves: [number, number][] = [];
      board.forEach((piece, from) => {
        if (piece?.side === side)
          for (const to of legalTargets(board, from)) moves.push([from, to]);
      });
      if (!moves.length) break;
      const doubled = new Set<string>();
      let ambiguous = false;
      const files = new Map<string, number>();
      board.forEach((piece, i) => {
        if (piece?.side === side) {
          const key = `${piece.kind}:${i % 9}`;
          files.set(key, (files.get(key) ?? 0) + 1);
        }
      });
      for (const [key, count] of files)
        if (count > 1) {
          const kind = key.split(':')[0];
          if (doubled.has(kind)) ambiguous = true;
          doubled.add(kind);
        }
      const byText = new Map<string, number>();
      for (const [from, to] of moves) {
        const text = wxfNotation(board, from, to);
        assert.match(text, /^([+\-2-5]?[KAEHRCP]|[KAEHRCP][1-9])[+\-=][1-9]$/);
        byText.set(text, (byText.get(text) ?? 0) + 1);
      }
      const [from, to] = moves[Math.floor(random() * moves.length)];
      if (!ambiguous) {
        assert.equal(byText.get(wxfNotation(board, from, to)), 1);
        compared++;
      }
      board = moveBoard(board, from, to);
      side = side === 'red' ? 'black' : 'red';
    }
  }
  assert(compared > 500);
});
test('历史着法在英文里按局面重算，不翻译存下来的中文', () => {
  const room = newRoom('r', { id: 'red', name: NAME.player }, 0, 1000);
  applyAction(room, 'black', { action: 'join', name: NAME.player }, 1000);
  applyAction(room, 'red', { action: 'move', from: 70, to: 67 }, 1000);
  applyAction(room, 'black', { action: 'move', from: 7, to: 24 }, 1000);
  const [one, two] = room.history;
  assert.equal(one.text, '炮二平五');
  assert.equal(historyMoveText(one, 'wxf'), 'C2=5');
  assert.equal(historyMoveText(two, 'wxf'), 'H8+7');
  assert.equal(historyMoveText(one, 'chinese'), '炮二平五');
  // An old room stored a simplified 车: the Chinese side still draws 車.
  assert.equal(
    historyMoveText({ ...one, text: '车一进一' }, 'chinese'),
    '車一进一',
  );
  assert.equal(historyMoveText({ ...one, text: '车一进一' }, 'wxf'), 'C2=5');
});
test('棋谱列表：英文显示 WXF，没有语言提供者时仍是中文', () => {
  const room = newRoom('r', { id: 'red', name: NAME.player }, 0, 1000);
  applyAction(room, 'black', { action: 'join', name: NAME.player }, 1000);
  applyAction(room, 'red', { action: 'move', from: 70, to: 67 }, 1000);
  applyAction(room, 'black', { action: 'move', from: 7, to: 24 }, 1000);
  const record = (extra = {}) =>
    createElement(GameRecord, {
      history: room.history,
      index: 2,
      onNavigate: () => {},
      onLive: () => {},
      ...extra,
    });
  const english = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      { page: 'home', initialLocale: 'en' },
      record(),
    ),
  );
  assert(english.includes('C2=5') && english.includes('H8+7'));
  assert(english.includes('Previous move'));
  assert(!CJK.test(english));
  const chinese = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      { page: 'home', initialLocale: 'zh' },
      record(),
    ),
  );
  assert(chinese.includes('炮二平五') && chinese.includes('上一步'));
  assert.equal(renderToStaticMarkup(record()), chinese);
});

test('棋盘设置菜单里能选语言，两种语言各用自己的名字，当前的标记出来', () => {
  const settings = {
    sound: true,
    hints: true,
    moveEffects: true,
    resultEffects: true,
  };
  const menu = (locale: 'zh' | 'en') =>
    renderToStaticMarkup(
      createElement(
        LocaleProvider,
        { page: 'home', initialLocale: locale },
        createElement(EffectSettings, { settings, onChange: () => {} }),
      ),
    );
  const english = menu('en');
  assert(english.includes('>中文<') && english.includes('>English<'));
  assert(english.includes('Language'));
  assert.match(english, /aria-pressed="true"[^>]*>English</);
  const chinese = menu('zh');
  assert(chinese.includes('语言'));
  assert.match(chinese, /aria-pressed="true"[^>]*>中文</);
  // Without a provider the menu is Chinese, as before.
  assert.equal(
    renderToStaticMarkup(
      createElement(EffectSettings, { settings, onChange: () => {} }),
    ),
    chinese,
  );
});

// ---- Stored tokens are shown in the viewer's language, and only then ----
const REASONS = [
  REASON.mate,
  REASON.stalemate,
  REASON.timeout,
  REASON.perpetual,
  REASON.agreed,
  REASON.repetition,
  REASON.quiet,
  REASON.resigned.red,
  REASON.resigned.black,
];
test('终局原因：中文原样，英文翻译，不认识的原因照原样显示', () => {
  for (const reason of REASONS) {
    assert.equal(reasonText('zh', reason), reason);
    assert(!CJK.test(reasonText('en', reason)), reason);
  }
  assert.equal(reasonText('en', REASON.mate), 'Checkmate');
  assert.equal(reasonText('en', REASON.stalemate), 'No legal moves');
  assert.equal(reasonText('en', REASON.resigned.black), 'Black resigned');
  assert.equal(reasonText('en', '以后新增的原因'), '以后新增的原因');
  assert.equal(reasonText('en', 'toString'), 'toString');
});
test('默认名字：中文原样，英文翻译；用户自己起的名字不动', () => {
  assert.equal(playerName('zh', NAME.player), '棋友');
  assert.equal(playerName('en', NAME.player), 'Player');
  assert.equal(playerName('en', NAME.me), 'You');
  assert.equal(playerName('en', NAME.ai), 'Xiangqi AI');
  assert.equal(playerName('en', '老张'), '老张');
  assert.equal(playerName('en', 'Alice'), 'Alice');
});
test('存储用的口令没有改动（旧存档、旧房间靠它们比对）', () => {
  assert.deepEqual(REASONS, [
    '将死',
    '困毙',
    '超时',
    '长将判负',
    '双方同意和棋',
    '三次重复局面',
    '连续 60 回合未吃子',
    '红方认输',
    '黑方认输',
  ]);
  assert.deepEqual(
    [NAME.player, NAME.me, NAME.ai],
    ['棋友', '我方', '象棋 AI'],
  );
  const room = newRoom('r', { id: 'a', name: NAME.me }, 0, 1000);
  applyAction(room, 'b', { action: 'join', name: NAME.ai }, 1000);
  applyAction(room, 'a', { action: 'resign' }, 1000);
  assert.deepEqual(room.result, { winner: 'black', reason: '红方认输' });
  assert.equal(room.players.red.name, '我方');
  assert.equal(room.players.black?.name, '象棋 AI');
});
test('旧存档照常读取、重放，并能用英文标注', () => {
  const room = newRoom(
    'old',
    { id: 'red', name: NAME.me },
    0,
    Date.parse('2026-06-15T12:00:00Z'),
  );
  applyAction(room, 'black', { action: 'join', name: NAME.ai }, 1000);
  applyAction(room, 'red', { action: 'move', from: 70, to: 67 }, 1000);
  applyAction(room, 'red', { action: 'resign' }, 1000);
  const game = archiveGame(room, {
    id: 'ai:old:1',
    date: '2026-06-15T12:00:00.000Z',
    mode: { kind: 'ai', level: 'medium' },
    viewerSide: 'red',
  });
  // What an archive written before this change looks like, byte for byte.
  const stored = JSON.parse(JSON.stringify(game));
  assert.equal(stored.result.reason, '红方认输');
  assert.deepEqual(stored.players, { red: '我方', black: '象棋 AI' });
  const parsed = parseArchive(stored)!;
  assert.deepEqual(replayArchive(parsed).result, game.result);
  assert.deepEqual(archiveLabel(parsed), { opponent: '象棋 AI', result: '负' });
  assert.deepEqual(archiveLabel(parsed, 'en'), {
    opponent: 'Xiangqi AI',
    result: 'Lost',
  });
  assert.equal(
    archiveLabel({ ...parsed, viewerSide: null }, 'en').result,
    'Black won',
  );
  assert.equal(
    archiveLabel({ ...parsed, viewerSide: null }, 'en').opponent,
    'You / Xiangqi AI',
  );
  assert.equal(archiveLabel({ ...parsed, viewerSide: null }).result, '黑方胜');
  assert.match(formatDateTime('en', parsed.date), /2026/);
  assert.equal(
    formatDateTime('zh', parsed.date),
    new Date(parsed.date).toLocaleString('zh-CN'),
  );
});

// ---- Ink stamps ----
test('印章：中文字样不变，英文显示英文词，换语言即时生效', () => {
  const mate = resultEffect({ winner: 'red', reason: REASON.mate }, 'x');
  assert.equal(mate.title, '绝杀');
  assert.equal(stampWords('en', mate).title, 'Mate');
  assert.equal(stampWords('en', mate).detail, 'Red wins · Checkmate');
  assert.equal(stampWords('zh', mate).detail, '红方获胜 · 将死');
  const check = {
    ...resultEffect({ winner: 'red', reason: REASON.mate }, 'y'),
    text: {
      title: 'stamp.check' as const,
      detail: 'stamp.check.detail' as const,
      side: 'black' as const,
    },
  };
  assert.equal(stampWords('zh', check).word, '将');
  assert.equal(stampWords('en', check).word, 'Check');
  assert.equal(stampWords('en', check).detail, 'Black must answer');
  for (const reason of [
    REASON.stalemate,
    REASON.timeout,
    REASON.perpetual,
    REASON.resigned.red,
    REASON.quiet,
  ]) {
    const words = stampWords(
      'en',
      resultEffect({ winner: 'black', reason }, 'z', true),
    );
    assert(!CJK.test(words.title + words.detail), reason);
    assert(words.detail.startsWith('Exploring · '));
  }
  const draw = resultEffect({ winner: 'draw', reason: REASON.agreed }, 'd');
  assert.equal(draw.title, '和棋');
  assert.equal(stampWords('en', draw).title, 'Draw');
  assert.equal(stampWords('en', draw).detail, 'Draw by agreement');
  const feedback = updateFeedback(
    { id: 'r', round: 1, version: 1, history: [], result: null, turn: 'red' },
    {
      id: 'r',
      round: 1,
      version: 2,
      history: [
        {
          side: 'red',
          captured: { side: 'black', kind: 'h', id: 'h' },
          check: false,
        } as Move,
      ],
      result: null,
      turn: 'black',
    },
  );
  assert.equal(feedback.effect?.title, '吃');
  assert.equal(stampWords('en', feedback.effect!).title, 'Capture');
});

// ---- Errors ----
test('错误码：每个码都有两种语言，AppError 的 message 仍是中文', () => {
  const codes = keys.filter((key) => key.startsWith('err.'));
  assert(codes.length >= 50);
  for (const key of codes) {
    const code = key.slice(4) as never;
    const error = new AppError(code, { n: 4 });
    assert.equal(error.message, t('zh', key, { n: 4 }));
    assert.equal(error.code, code);
    assert(en.messages[key].length > 8);
  }
  const full = new GameError('room-full', 409);
  assert.equal(full.status, 409);
  assert.equal(full.message, '棋桌已坐满，你可以观战。');
});
test('接口错误同时带中文 error 和 code；客户端按当前语言显示，认不出的码用 error', () => {
  assert.deepEqual(errorBody('sign-in-required'), {
    error: '请先登录。',
    code: 'sign-in-required',
  });
  assert.deepEqual(errorBody('analysis-ply-incomplete', { n: 7 }), {
    error: '第 7 步未获得完整评分，请重试',
    code: 'analysis-ply-incomplete',
  });
  const served = apiError(errorBody('room-full'), 409, 'action-failed');
  assert.equal(served.code, 'room-full');
  assert.equal(
    errorText('zh', errorInfo(served, 'action-failed')),
    '棋桌已坐满，你可以观战。',
  );
  assert.equal(
    errorText('en', errorInfo(served, 'action-failed')),
    'The table is full, but you can watch.',
  );
  const newer = apiError(
    { error: '一个新的错误。', code: 'added-later' },
    400,
    'action-failed',
  );
  assert.equal(
    errorText('en', errorInfo(newer, 'action-failed')),
    '一个新的错误。',
  );
  const bare = apiError({ error: '旧服务器的话。' }, 400, 'action-failed');
  assert.equal(bare.code, undefined);
  assert.equal(
    errorText('en', errorInfo(bare, 'action-failed')),
    '旧服务器的话。',
  );
  const empty = apiError({}, 500, 'action-failed');
  assert.equal(
    errorText('en', errorInfo(empty, 'action-failed')),
    'That did not go through.',
  );
  assert.equal(
    errorText('zh', errorInfo(empty, 'action-failed')),
    '操作未成功。',
  );
  const analysis = errorInfo(
    new AppError('analysis-ply-incomplete', { n: 3 }),
    'analysis-failed',
  );
  assert.equal(
    errorText('en', analysis),
    'Move 3 did not get a complete score. Please try again.',
  );
  assert.equal(errorText('zh', analysis), '第 3 步未获得完整评分，请重试');
  assert.equal(
    errorText(
      'en',
      errorInfo(new TypeError('Failed to fetch'), 'network-unstable'),
    ),
    'Failed to fetch',
  );
  assert.equal(
    errorText('en', errorInfo('not an error', 'network-unstable')),
    'The network looks unstable. Please try again in a moment.',
  );
  assert.equal(hasMessage('err.room-full'), true);
  assert.equal(hasMessage('err.nope'), false);
});

// ---- Room notes ----
const played = () => {
  const room: Room = newRoom('n', { id: 'red', name: NAME.player }, 0, 1000);
  return room;
};
test('房间提示：旧的纯文字原样显示，新的按语言生成', () => {
  const room = played();
  assert.deepEqual(room.note, { key: 'table-ready' });
  assert.equal(noteText('zh', room, 'chinese'), '棋桌已备好，等待好友入座');
  assert.equal(
    noteText('en', room, 'wxf'),
    'The table is set. Waiting for a friend to sit down.',
  );
  const legacy = { ...room, note: '好友已入座，红方先行' };
  assert.equal(noteText('en', legacy, 'wxf'), '好友已入座，红方先行');
  applyAction(room, 'b', { action: 'join', name: NAME.player }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '好友已入座，红方先行');
  applyAction(room, 'red', { action: 'move', from: 70, to: 67 }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '炮二平五');
  assert.equal(noteText('en', room, 'wxf'), 'C2=5');
  applyAction(room, 'b', { action: 'move', from: 25, to: 70 }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '炮8进5');
  assert.equal(noteText('en', room, 'wxf'), 'C8+5');
  applyAction(room, 'red', { action: 'undo' }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '红方悔了一步 · 炮8进5');
  assert.equal(noteText('en', room, 'wxf'), 'Red took back a move · C8+5');
  applyAction(room, 'b', { action: 'offer-draw' }, 1000);
  applyAction(room, 'red', { action: 'respond', accept: false }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '红方婉拒了提和');
  assert.equal(noteText('en', room, 'wxf'), 'Red declined the draw offer');
  applyAction(room, 'red', { action: 'resign' }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '红方认输');
  assert.equal(noteText('en', room, 'wxf'), 'Red resigned');
  applyAction(room, 'red', { action: 'offer-rematch' }, 1000);
  assert.equal(noteText('en', room, 'wxf'), 'Red invites a restart');
  applyAction(room, 'b', { action: 'respond', accept: true }, 1000);
  assert.equal(noteText('zh', room, 'chinese'), '交换先后手，新一局开始');
  assert.equal(
    noteText('en', room, 'wxf'),
    'Sides swapped. A new game begins.',
  );
  assert(!CJK.test(noteText('en', room, 'wxf')));
});
test('房间的字段保持原样：note 之外没有新增，历史里仍存中文着法', () => {
  const room = played();
  applyAction(room, 'b', { action: 'join', name: NAME.player }, 1000);
  applyAction(room, 'red', { action: 'move', from: 70, to: 67 }, 1000);
  assert.deepEqual(
    Object.keys(room).sort(),
    [
      'board',
      'chat',
      'clockMinutes',
      'clocks',
      'createdAt',
      'history',
      'id',
      'note',
      'offer',
      'players',
      'quiet',
      'result',
      'round',
      'turn',
      'turnAt',
    ].sort(),
  );
  assert.equal(room.history[0].text, '炮二平五');
});

// ---- Commentary ----
test('讲解：英文是自然的英文句子，着法用 WXF，中文输出不变', () => {
  const before = initialBoard();
  const { from, to } = engineMove('i1i2')!;
  const move: Move = {
    from,
    to,
    side: 'red',
    text: notation(before, from, to),
    captured: null,
    check: false,
    before,
    clocks: { red: 0, black: 0 },
    quietBefore: 0,
  };
  const evaluation = (score: number, pv: string[]) => ({
    score: { kind: 'cp' as const, value: score },
    depth: 12,
    pv,
  });
  const result = analyseMove({
    ply: 1,
    side: 'red',
    move: 'i1i2',
    before: evaluation(0, ['h1g3', 'h10g8']),
    after: evaluation(-300, ['h8h1']),
    played: evaluation(-300, ['i1i2', 'h8h1']),
  });
  const chinese = explainMove(move, result);
  assert.deepEqual(chinese, explainMove(move, result, 'zh'));
  assert.deepEqual(chinese.problem, [
    '红車走开后，红马失去保护，黑方可以炮8进7吃掉它。',
  ]);
  const english = explainMove(move, result, 'en');
  assert.deepEqual(english.problem, [
    'With the Red Chariot gone, the Red Horse is no longer protected. Black can capture it with C8+7.',
  ]);
  assert.equal(
    english.reason[0],
    'The engine prefers H2+3. Evaluation afterwards: Even; main line: H2+3, H8+7.',
  );
  assert(english.certain);
  for (const text of [...english.problem, ...english.reason])
    assert(!CJK.test(text), text);
  // The notation is its own choice: English text can still use the Chinese notation.
  assert.match(explainMove(move, result, 'en', 'chinese').problem[0], /炮8进7/);
  assert.equal(scoreText({ kind: 'cp', value: 133 }, 'en'), 'Red +133');
  assert.equal(scoreText({ kind: 'cp', value: -767 }, 'en'), 'Black +767');
  assert.equal(scoreText({ kind: 'cp', value: 4 }, 'en'), 'Even');
  assert.equal(
    scoreText({ kind: 'mate', winner: 'red', plies: 5 }, 'en'),
    'Red mates in 3',
  );
  assert.equal(scoreText({ kind: 'result', winner: 'draw' }, 'en'), 'Draw');
  assert.equal(scoreText(null, 'en'), 'Analyzing…');
  assert.equal(ratingLabel('en', 'blunder'), '??');
  assert.equal(ratingLabel('en', 'blunder', true), 'Blunder');
  assert.equal(ratingLabel('zh', 'blunder'), '错');
});

test('讲解：同样的局面在两种语言里各个模板都填满了参数', () => {
  const cp = (value: number): AnalysisScore => ({ kind: 'cp', value });
  const line = (score: AnalysisScore, pv: string[]) => ({
    score,
    depth: 12,
    pv,
  });
  const apply = (tokens: string[], start = initialBoard()) =>
    tokens.reduce((board, token) => {
      const { from, to } = engineMove(token)!;
      return moveBoard(board, from, to);
    }, start);
  const explain = (
    before: Board,
    side: Side,
    token: string,
    lines: {
      best: string[];
      actual: string[];
      bestScore?: AnalysisScore;
      playedScore?: AnalysisScore;
    },
    locale: 'zh' | 'en',
  ) => {
    const { from, to } = engineMove(token)!;
    const move: Move = {
      from,
      to,
      side,
      text: notation(before, from, to),
      captured: before[to],
      check: false,
      before,
      clocks: { red: 0, black: 0 },
      quietBefore: 0,
    };
    const played = lines.playedScore ?? cp(side === 'red' ? -300 : 300);
    const result = analyseMove({
      ply: 1,
      side,
      move: token,
      before: line(lines.bestScore ?? cp(0), lines.best),
      after: line(played, lines.actual.slice(1)),
      played: line(played, lines.actual),
    });
    return explainMove(move, result, locale);
  };
  const hung = apply(['i1i2', 'b8e8']);
  const attacked = apply(['i1i2', 'a10a9']);
  const fork = mk([
    ['red', 'k', 'e1'],
    ['red', 'h', 'c3'],
    ['black', 'k', 'd10'],
    ['black', 'r', 'b6'],
    ['black', 'h', 'f6'],
    ['black', 'p', 'd6'],
  ]);
  const cases: [string, () => ReturnType<typeof explainMove>[]][] = [
    [
      'hung',
      () =>
        (['zh', 'en'] as const).map((locale) =>
          explain(
            hung,
            'red',
            'i2h2',
            { best: ['h1g3'], actual: ['i2h2', 'h8h2'] },
            locale,
          ),
        ),
    ],
    [
      'ignored',
      () =>
        (['zh', 'en'] as const).map((locale) =>
          explain(
            attacked,
            'red',
            'g4g5',
            { best: ['h1g3', 'a9d9'], actual: ['g4g5', 'h8h1'] },
            locale,
          ),
        ),
    ],
    [
      'fork',
      () =>
        (['zh', 'en'] as const).map((locale) =>
          explain(
            fork,
            'red',
            'e1e2',
            {
              best: ['c3d5'],
              actual: ['e1e2', 'b6b5'],
              bestScore: cp(300),
              playedScore: cp(0),
            },
            locale,
          ),
        ),
    ],
    [
      'missed capture',
      () =>
        (['zh', 'en'] as const).map((locale) =>
          explain(
            apply(['i1i2', 'b8e8', 'i2h2']),
            'black',
            'e8e4',
            {
              best: ['h8h2', 'h1g3'],
              actual: ['e8e4', 'h2h8'],
              bestScore: cp(-650),
              playedScore: cp(-100),
            },
            locale,
          ),
        ),
    ],
    [
      'mates',
      () =>
        (['zh', 'en'] as const).flatMap((locale) => [
          explain(
            initialBoard(),
            'red',
            'h3e3',
            {
              best: ['b3e3'],
              actual: ['h3e3', 'h10g8', 'h1g3', 'i10h10'],
              playedScore: { kind: 'mate', winner: 'black', plies: 3 },
            },
            locale,
          ),
          explain(
            initialBoard(),
            'red',
            'i1i2',
            {
              best: ['h3e3'],
              actual: ['i1i2', 'h10g8'],
              bestScore: { kind: 'mate', winner: 'red', plies: 1 },
              playedScore: cp(0),
            },
            locale,
          ),
        ]),
    ],
  ];
  const sentences: Record<string, string[]> = {};
  for (const [name, run] of cases) {
    const outputs = run();
    for (const c of outputs) {
      for (const text of [...c.problem, ...c.reason])
        assert(!/[{}]/.test(text), `${name}: ${text}`);
    }
    // zh outputs come first; the English ones follow with no Chinese in them.
    const english = name === 'mates' ? outputs.slice(2) : outputs.slice(1);
    for (const c of english)
      for (const text of [...c.problem, ...c.reason])
        assert(!CJK.test(text), `${name}: ${text}`);
    sentences[name] = english.flatMap((c) => [...c.problem, ...c.reason]);
  }
  assert.deepEqual(sentences.hung, [
    'R1=2 puts the Red Chariot where the Black Cannon can capture it for free.',
    'The engine prefers H2+3. Evaluation afterwards: Even; main line: H2+3.',
  ]);
  assert.deepEqual(sentences.ignored, [
    'Black was already attacking the Red Horse, and this move does not deal with it.',
    'H2+3 moves the attacked Red Horse to safety.',
  ]);
  assert.equal(
    sentences.fork[1],
    'H7+6 attacks the Black Chariot and the Black Horse at once, and Black cannot save both.',
  );
  assert.deepEqual(sentences['missed capture'], [
    'This misses a chance to win material: C8+6 captures the Red Chariot.',
    'In the recommended line (C8+6), Black nets about 9 points of material.',
  ]);
  assert.deepEqual(sentences.mates.slice(0, 1), [
    'This allows Black to mate in 2: H8+7, H2+3, R9=8.',
  ]);
  assert(sentences.mates.includes('This misses a forced mate.'));
  assert(
    sentences.mates.includes(
      'A mate in 1 was available, starting with C2=5: C2=5.',
    ),
  );
});

// ---- Nothing Chinese is left in the code that builds the English interface ----
/** Chinese that stays: the graphics (seals, river, avatars, lobby art), words spoken by a
 * Chinese voice, and guard errors that are never shown (anything shown has a code). */
const ALLOWED: Record<string, string[]> = {
  'lib/tokens.ts': ['*'],
  'lib/xiangqi.ts': ['*'],
  'lib/locales/zh.ts': ['*'],
  'app/page.tsx': ['楚', '帅', '将'],
  'components/ai-game.tsx': ['楚', '帅', '将'],
  'components/chess-board.tsx': ['楚 河', '漢 界'],
  'components/game-lobby.tsx': ['楚 河', '汉 界', '馬', '将', '帅'],
  'lib/game-audio.ts': ['吃', '将军'],
  // Full-width parentheses: trimming a long Google display name, not interface text.
  'worker/google.ts': ['（', '）'],
  'lib/ai-game.ts': ['无效棋盘坐标'],
  'lib/ai-engine.ts': ['无效的限定搜索着法'],
  'lib/archive.ts': ['只能保存已结束的完整对局'],
  'lib/archive-storage.ts': [
    '本地存储不可用',
    '存档数据库打开超时',
    '存档数据库被占用',
  ],
  'lib/analysis-cache.ts': [
    '分析结果与对局不匹配，未写入缓存',
    '分析缓存打开超时',
    '分析缓存被其他页面占用',
  ],
  'lib/client-api.ts': [
    '无效棋室请求',
    '账号状态读取失败',
    '退出登录失败',
    '删除账号失败',
    '账号对局读取失败',
    '对局上传失败',
  ],
  'lib/game-analysis.ts': [
    '无效走棋方',
    '评级阈值必须在 0 到 1 之间严格递增',
    '分数换算尺度必须为有限正数',
    '分数必须为有限数',
    '杀棋距离必须为非负整数',
    '无效评分类型',
    '无效引擎记谱',
    '搜索深度必须为非负整数',
    '胜率损失必须在 0 到 1 之间',
    '步号必须从 1 开始',
    '已终局的局面不能继续评级走子',
    '限定搜索与实际着法不一致',
    '缺少对局标识',
    '存档中没有这一步',
  ],
};
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
test('components/、app/、lib/、worker/、web/ 里没有写死的中文（词典与白名单除外）', () => {
  const files = ['components', 'app', 'lib', 'worker', 'web', 'hooks'].flatMap(
    sources,
  );
  assert(files.length > 60);
  const leaks: string[] = [];
  for (const file of files) {
    const allowed = ALLOWED[file] ?? [];
    if (allowed.includes('*')) continue;
    let code = withoutComments(readFileSync(file, 'utf8'));
    for (const literal of allowed) code = code.split(literal).join('');
    code.split('\n').forEach((line, i) => {
      if (CJK.test(line))
        leaks.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(leaks, []);
  // The allowlist itself must not rot: every entry is still in its file.
  for (const [file, literals] of Object.entries(ALLOWED))
    for (const literal of literals)
      if (literal !== '*')
        assert(
          readFileSync(file, 'utf8').includes(literal),
          `${file} 不再含有 ${literal}`,
        );
});

console.log(`${checks} i18n checks passed`);
