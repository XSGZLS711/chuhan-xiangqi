# 楚汉棋社 · Agent notes

A free xiangqi web app (overseas, maintained solo): a Vite + React SPA plus one Cloudflare Worker (Hono, D1), served same-origin at https://chuhanxiangqi.com (staging: https://staging.chuhanxiangqi.com).
The browser AI is Fairy-Stockfish WASM under `/ai/`. It needs cross-origin isolation, which `public/_headers` provides.
Plan: `ROADMAP.md`. Competitor study notes live only on the owner's machine in `research/tiantian/` (gitignored): read them when present, keep them out of Git.

## Rules
- Reply to the user in Chinese. Report test results honestly; say what was not verified.
- Work on a branch; `main` auto-deploys staging. Push and open a PR when the user asks.
- Deploys, secrets and remote migrations belong to the owner (`npm run deploy`, `deploy:staging`, `wrangler deploy`, `wrangler secret put`, `db:migrate:staging`, `db:migrate:production`): hand the user the command to run. The D1 ids in `wrangler.jsonc` stay as they are.
- Keep `lib/xiangqi.ts`, `lib/game.ts` and `lib/presentation.ts` pure (no DOM, no React): the long-term goal is a WeChat mini program on the same core.
- Run `npm run format` (oxfmt) only on files you changed.
- Sound is Web Audio synthesis plus one CC0 move recording (`public/sounds/SOURCE.md`). Art is our own SVG/CSS; fonts are open-licensed and self-hosted (`/ai/` runs under COEP, so no font CDN).
- UI copy is deliberate, wordplay included (「再蒸一下」 is intended): ask before rewording.
- Match the surrounding code style: comment density, naming and idiom.
- Lint baseline: several files already carry oxlint errors; files you touch end with no more than they started with.

## Commands
- `npm run dev`: local dev server on :5173, applying local D1 migrations first. Google sign-in needs `.dev.vars` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, owner's machine only); without it the login button stays hidden.
- Checks before you report done, the same list CI runs: `typecheck`, `test`, `test:ui`, `test:mobile`, `test:ai`, `test:identity`, `test:archive`, `test:analysis`, `test:audio`, `build`.
- `node tests/online.test.mjs <base-url>` against a dev server or staging (it leaves a test room behind, so keep it off production).

## Map
- `app/page.tsx`: lobby and friend rooms. `components/ai-game.tsx`: AI games, and the review of any archived game at `/ai/?game=<id>`.
- `components/review-screen.tsx`, `lib/review.ts`, `lib/explain.ts`: the review (chart, analysis, report, practice) and its rule-based commentary.
- `lib/archive.ts`, `lib/archive-storage.ts`, `lib/use-auto-archive.ts`, `components/recent-games.tsx`: the local archive (IndexedDB, newest 200), saved when a game ends, listed as 最近对局.
- `components/chess-board.tsx`, `components/board-effect.tsx`, `lib/motion.ts`, `lib/game-audio.ts`, `app/globals.css`: board, motion, effects, sound.
- `worker/`: `game-api.ts` rooms; `identity.ts` the cookie; `google.ts` OAuth (pure); `accounts.ts` accounts, sessions and seat moves in D1; `auth.ts` the routes. Schema in `db/schema.ts`, migrations in `drizzle/` via `npm run db:generate`.

## Current task: M1 step 2, sync 最近对局 to the account
Goal (ROADMAP M1): sign in on another device and see your game history.
Today games are archived only in the browser. Accounts exist (`users`, `identities`, `sessions`), and `player(req, db)` in `worker/accounts.ts` returns `{ id, signedIn }`.
1. A D1 table of archived games per account, keyed by account and game id, holding the compact `ArchivedGame` JSON. One migration.
2. API, signed-in only, with the same-origin check `logout` uses: list (newest first, paged), upload (idempotent by game id, validated with `parseArchive`, size-capped), delete one.
3. Client, when signed in: upload local games the server lacks, then each game once as it ends; merge the server list into 最近对局. A game only the server has opens in the review like a local one.
4. Deleting the account deletes its games. Update `public/privacy.html` in both languages: signed-in players' games are now stored on the server.
5. Tests: the API rules in `tests/accounts.test.ts` (local D1), the merge in `tests/archive.test.ts`.

Done when every check passes, two browsers signed into one account list the same 最近对局, anonymous play behaves as before, and the user gets a short Chinese summary of what changed and what was not verified. D1's free tier allows 100k writes a day, so each game is uploaded once.
