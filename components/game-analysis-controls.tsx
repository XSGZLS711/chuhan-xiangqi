import type { useGameAnalysis } from '@/lib/use-game-analysis';

export default function GameAnalysisControls({
  analysis,
}: {
  analysis: ReturnType<typeof useGameAnalysis>;
}) {
  const total = analysis.analysis?.moves.length ?? 0;
  const done =
    analysis.analysis?.moves.filter((entry) => entry.status === 'complete')
      .length ?? 0;
  const loading = analysis.status === 'loading';
  return (
    <section className="whole-game-analysis" aria-label="整局分析">
      <div>
        <strong>整局分析</strong>
        {analysis.busy ? (
          <button
            onClick={analysis.cancel}
            disabled={analysis.status === 'cancelling'}
          >
            {analysis.status === 'cancelling' ? '正在停止…' : '取消'}
          </button>
        ) : (
          <button
            onClick={analysis.start}
            disabled={loading || !analysis.enabled || !total || done === total}
          >
            {loading
              ? '读取缓存…'
              : done === total && total
                ? '已完成'
                : done
                  ? '继续分析'
                  : '开始分析'}
          </button>
        )}
      </div>
      <progress
        max={Math.max(1, total)}
        value={done}
        aria-label="整局分析进度"
      />
      <output aria-live="polite">
        {loading
          ? '正在读取缓存'
          : !total
            ? '本局没有可分析的着法'
            : `${analysis.status === 'cancelled' ? '已取消 · ' : analysis.busy ? '分析中 · ' : ''}${done} / ${total} 步`}
      </output>
      {analysis.error && <p role="alert">{analysis.error}</p>}
      {analysis.cacheMessage && <p>{analysis.cacheMessage}</p>}
      <small>评级为引擎估计，未标记的着法不显示徽章。</small>
    </section>
  );
}
