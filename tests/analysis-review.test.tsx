import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import GameRecord from '../components/game-record';
import { createAiMatch, playAiMove, squareToEngine } from '../lib/ai-game';
import { createGameAnalysis, completeMoveAnalysis } from '../lib/game-analysis';
import { ratingReviewSelection } from '../lib/analysis-review';

let match = createAiMatch('red', 'medium');
for (const [from, to] of [
  [88, 69],
  [27, 36],
  [89, 88],
  [25, 88],
])
  match = playAiMove(match, from, to);
const history = match.room.history;
let analysis = createGameAnalysis(
  'test',
  history.map((move) => squareToEngine(move.from) + squareToEngine(move.to)),
);
analysis = completeMoveAnalysis(
  analysis,
  3,
  { depth: 12, score: { kind: 'cp', value: 400 }, pv: ['i1i2'] },
  { depth: 12, score: { kind: 'cp', value: -500 }, pv: ['h8h1'] },
  { depth: 12, score: { kind: 'cp', value: -600 }, pv: ['i1h1', 'h8h1'] },
);
const selection = ratingReviewSelection(history, analysis, 3);
assert.equal(selection?.index, 2);
assert.equal(selection?.recommendation, '車一进一');
assert.equal(history[selection!.index].before[89]?.kind, 'r');
assert.equal(history[selection!.index].before[88], null);
assert.equal(ratingReviewSelection(history, analysis, 0), null);
assert.equal(ratingReviewSelection(history, analysis, 5), null);
assert.equal(
  ratingReviewSelection(history, analysis, 1),
  null,
  '未完成着法没有评级',
);
const html = renderToStaticMarkup(
  <GameRecord
    history={history}
    index={2}
    analysis={analysis}
    ratedPly={3}
    onNavigate={() => {}}
    onLive={() => {}}
    onRatingSelect={() => {}}
  />,
);
assert(html.includes('第 3 步，错，查看走前推荐着'));
assert(html.includes('selected-rating'));
assert.equal((html.match(/class="move-rating/g) ?? []).length, 1);
const plain = renderToStaticMarkup(
  <GameRecord
    history={history}
    index={2}
    onNavigate={() => {}}
    onLive={() => {}}
  />,
);
assert(!plain.includes('move-rating'), '普通好友棋谱不出现分析徽章');
console.log('✓ 徽章呈现、走前跳转、合法中文推荐着与普通棋谱兼容');
