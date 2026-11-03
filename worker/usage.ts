/** What games cost on the free plan, counted in this isolate since it started. Production
 * runs many isolates, each with its own count, so only the local dev server and local preview
 * report it (`GET /api/game?usage`), for `tests/online.test.mjs` to measure a game. */
export const usage = {
  /** Requests to /api/game*, each one Worker request. */
  worker: 0,
  /** Calls into a Durable Object: RPC, socket upgrades, alarms. */
  durable: 0,
  /** Messages a socket sent in; 20 count as one request. */
  socketMessages: 0,
  socketCloses: 0,
  alarms: 0,
  /** Rows a Durable Object wrote, `setAlarm` counted as one. */
  durableRowsWritten: 0,
  d1RowsWritten: 0,
};

export const isLocal = (req: Request) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname);
