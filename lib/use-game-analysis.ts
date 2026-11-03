import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserEngine } from './ai-engine';
import { errorInfo, type ErrorInfo } from './errors';
import { analyseGame } from './analyse-game';
import { analysisCache } from './analysis-cache';
import type { ArchivedGame } from './archive';
import type { Room } from './game';
import { createGameAnalysis, type GameAnalysis } from './game-analysis';

type Status =
  | 'loading'
  | 'idle'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'complete'
  | 'error';
type State = {
  gameId: string | null;
  analysis: GameAnalysis | null;
  status: Status;
  /** What went wrong, as a code to show in the viewer's language. */
  error: ErrorInfo | null;
  cacheMessage: 'read-failed' | 'write-failed' | null;
};
const initial: State = {
  gameId: null,
  analysis: null,
  status: 'loading',
  error: null,
  cacheMessage: null,
};
const complete = (analysis: GameAnalysis) =>
  analysis.moves.every((entry) => entry.status === 'complete');

export function useGameAnalysis(
  game: ArchivedGame | null,
  room: Room,
  engine: BrowserEngine | null,
  enabled: boolean,
) {
  const [state, setState] = useState<State>(initial);
  const generation = useRef(0);
  const running = useRef<AbortController | null>(null);
  const current = state.gameId === game?.id ? state : initial;
  const stopCurrentRun = useCallback(() => {
    running.current?.abort();
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
    stopCurrentRun();
  }, [stopCurrentRun]);
  useEffect(() => {
    const token = ++generation.current;
    stopCurrentRun();
    running.current = null;
    if (!game) return;
    let active = true;
    void analysisCache()
      .load(game)
      .then((saved) => {
        if (!active || token !== generation.current) return;
        const analysis = saved ?? createGameAnalysis(game.id, game.moves);
        setState({
          gameId: game.id,
          analysis,
          status: complete(analysis) ? 'complete' : 'idle',
          error: null,
          cacheMessage: null,
        });
      })
      .catch(() => {
        if (!active || token !== generation.current) return;
        const analysis = createGameAnalysis(game.id, game.moves);
        setState({
          gameId: game.id,
          analysis,
          status: complete(analysis) ? 'complete' : 'idle',
          error: null,
          cacheMessage: 'read-failed',
        });
      });
    return () => {
      active = false;
      invalidate();
    };
  }, [game, stopCurrentRun, invalidate]);
  useEffect(
    () => () => {
      stopCurrentRun();
    },
    [engine, enabled, stopCurrentRun],
  );
  function cancel() {
    running.current?.abort();
    setState((state) =>
      state.status === 'running' ? { ...state, status: 'cancelling' } : state,
    );
  }
  function start() {
    if (
      !game ||
      !engine ||
      !enabled ||
      !current.analysis ||
      running.current ||
      current.status === 'complete'
    )
      return;
    const controller = new AbortController(),
      token = generation.current;
    running.current = controller;
    const belongs = () =>
      generation.current === token && running.current === controller;
    setState((state) => ({ ...state, status: 'running', error: null }));
    void analyseGame(room, {
      gameId: game.id,
      engine,
      signal: controller.signal,
      initial: current.analysis,
      async onProgress(analysis) {
        if (!belongs()) return;
        setState((state) => ({ ...state, analysis }));
        try {
          await analysisCache().save(game, analysis);
          if (belongs())
            setState((state) => ({ ...state, cacheMessage: null }));
        } catch {
          if (belongs())
            setState((state) => ({
              ...state,
              cacheMessage: 'write-failed',
            }));
        }
      },
    })
      .then((analysis) => {
        if (belongs())
          setState((state) => ({ ...state, analysis, status: 'complete' }));
      })
      .catch((error: unknown) => {
        if (!belongs()) return;
        if (controller.signal.aborted)
          setState((state) => ({
            ...state,
            status:
              state.analysis && complete(state.analysis)
                ? 'complete'
                : 'cancelled',
          }));
        else
          setState((state) => ({
            ...state,
            status: 'error',
            error: errorInfo(error, 'analysis-failed'),
          }));
      })
      .finally(() => {
        if (running.current === controller) running.current = null;
      });
  }
  return {
    ...current,
    start,
    cancel,
    enabled,
    busy: current.status === 'running' || current.status === 'cancelling',
  };
}
