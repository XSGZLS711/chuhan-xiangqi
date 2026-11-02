import { engineMove, parseEngineInfo, type EngineInfo } from './ai-game';
import type { Side } from './xiangqi';

/** Directory of the AI room, with or without a trailing slash in the address. */
export function aiBase(): URL {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

/**
 * The engine needs SharedArrayBuffer, which browsers only allow on a
 * cross-origin-isolated page. The Worker sends the required headers for /ai/.
 */
export async function prepareAiPage(): Promise<void> {
  if (!window.crossOriginIsolated) {
    throw new Error(
      '此浏览器无法启动本地棋手，请用新版 Safari、Chrome 或 Edge 打开。',
    );
  }
}

export type SearchOptions = {
  position: string;
  turn: Side;
  time: number;
  depth: number;
  skill: number;
  signal: AbortSignal;
  onInfo?: (info: EngineInfo) => void;
  searchMoves?: readonly string[];
};
const aborted = () => new DOMException('Search cancelled', 'AbortError');

/** One engine and one serialized search: no competing analysis and play jobs. */
export class BrowserEngine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private failures = new Set<(error: Error) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private dead = false;
  private fatalError: Error | null = null;
  readonly ready: Promise<void>;
  constructor() {
    this.worker = new Worker(new URL('engine-host.js', aiBase()));
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new Error('引擎加载超时，请重试。')),
        20000,
      );
      const fail = (error: Error) => {
        clearTimeout(timer);
        this.listeners.delete(line);
        this.failures.delete(fail);
        reject(error);
      };
      const line = (message: string) => {
        if (message === 'uciok') {
          [
            'setoption name UCI_Variant value xiangqi',
            'setoption name Use NNUE value false',
            'setoption name Threads value 1',
            'setoption name Hash value 16',
            'isready',
          ].forEach((c) => this.send(c));
        }
        if (message === 'readyok') {
          clearTimeout(timer);
          this.listeners.delete(line);
          this.failures.delete(fail);
          resolve();
        }
      };
      this.listeners.add(line);
      this.failures.add(fail);
    });
    // A disposed instance may be replaced while initialization is in flight.
    void this.ready.catch(() => {});
    this.worker.onmessage = (
      event: MessageEvent<{ type: string; line?: string; message?: string }>,
    ) => {
      if (event.data.type === 'loaded') this.send('uci');
      if (event.data.type === 'error')
        this.fail(new Error('象棋引擎启动失败，请刷新或更换浏览器。'));
      if (event.data.type === 'line')
        // Snapshot: listeners may add/remove subscriptions while handling a line.
        for (const f of Array.from(this.listeners)) f(event.data.line ?? '');
    };
    this.worker.onerror = () =>
      this.fail(
        new Error('本地棋手停止了，请重试；手机内存不足时可关闭其他页面。'),
      );
  }
  private send(command: string) {
    if (!this.dead) this.worker.postMessage(command);
  }
  private fail(error: Error) {
    this.fatalError = error;
    this.dead = true;
    for (const f of Array.from(this.failures)) f(error);
    this.worker.terminate();
  }
  dispose() {
    this.fail(aborted());
    this.listeners.clear();
    this.failures.clear();
  }
  search(options: SearchOptions): Promise<string | null> {
    const result = this.queue.then(() => this.run(options));
    this.queue = result.catch(() => {});
    return result;
  }
  private async run(o: SearchOptions): Promise<string | null> {
    await this.ready;
    if (o.signal.aborted) throw aborted();
    if (this.dead) throw this.fatalError ?? aborted();
    if (
      o.searchMoves &&
      (!o.searchMoves.length ||
        o.searchMoves.some((token) => {
          const move = engineMove(token);
          return !move || move.from === move.to;
        }))
    )
      throw new Error('无效的限定搜索着法');
    return new Promise((resolve, reject) => {
      let stopTimer: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(
        () => this.fail(new Error('这次计算超时，请重试。')),
        o.time + 10000,
      );
      const cleanup = () => {
        clearTimeout(timer);
        clearTimeout(stopTimer);
        this.listeners.delete(line);
        this.failures.delete(failure);
        o.signal.removeEventListener('abort', stop);
      };
      const failure = (error: Error) => {
        cleanup();
        reject(error);
      };
      const line = (message: string) => {
        if (!o.signal.aborted) {
          const info = parseEngineInfo(message, o.turn);
          if (info) o.onInfo?.(info);
        }
        if (message.startsWith('bestmove ')) {
          cleanup();
          if (o.signal.aborted) reject(aborted());
          else
            resolve(
              message.split(/\s+/)[1] === '(none)'
                ? null
                : message.split(/\s+/)[1],
            );
        }
      };
      const stop = () => {
        this.send('stop');
        // Do not issue a new position until the previous bestmove acknowledges stop.
        stopTimer = setTimeout(
          () => this.fail(new Error('计算未能停止，请重新加载棋手。')),
          4000,
        );
      };
      this.listeners.add(line);
      this.failures.add(failure);
      o.signal.addEventListener('abort', stop, { once: true });
      this.send(`setoption name Skill Level value ${o.skill}`);
      this.send(o.position);
      // This vendored engine consumes every token following searchmoves as a move.
      this.send(
        `go movetime ${o.time} depth ${o.depth}${o.searchMoves ? ` searchmoves ${o.searchMoves.join(' ')}` : ''}`,
      );
    });
  }
}
