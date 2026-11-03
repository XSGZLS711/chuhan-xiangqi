# 楚汉棋社 · Agent notes

A free xiangqi web app (overseas, maintained solo): a Vite + React SPA plus one Cloudflare Worker (Hono, D1), served same-origin.
The browser AI is Fairy-Stockfish WASM under `/ai/`. It needs cross-origin isolation, which `public/_headers` provides.
Plan: `ROADMAP.md`. Detailed notes for the current track are local-only in `research/tiantian/` (gitignored; read them, never commit them).

## Rules
- Reply to the user in Chinese. Report test results honestly; if something was not verified, say so.
- Work on a branch, never on `main`; pushing `main` auto-deploys staging. Do not `git push` unless the user asks.
- Never run `npm run deploy`, `deploy:staging`, `wrangler deploy`, `db:migrate:staging` or `db:migrate:production`. Never edit the D1 ids in `wrangler.jsonc`.
- Keep `lib/xiangqi.ts`, `lib/game.ts` and `lib/presentation.ts` pure (no DOM, no React) so the core stays portable.
- Do not run `npm run format` (oxfmt) over files you did not change; it reformats them.
- Sounds are synthesized with Web Audio (`lib/game-audio.ts`). No audio files and no copied assets. Art is our own SVG/CSS; fonts must be open-licensed and self-hosted.
- Match the surrounding code style: comment density, naming and idiom.

## Commands
- `npm run dev`: local dev server (applies local D1 migrations first).
- Checks before you report done: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:ui`, `npm run test:mobile`, `npm run test:ai`, `npm run test:identity`, `npm run build`.

## Map
- `app/page.tsx`: friend rooms. `components/ai-game.tsx`: the AI game with live analysis. `components/chess-board.tsx`: the board.
- `components/board-effect.tsx`: check/mate/result overlays. `lib/presentation.ts`: which sounds and effects a move triggers.
- `app/globals.css`: board motion (`piece-hop`, `.move-dot`, `.capture-target`, `.piece-position.selected`, capture ghost).
- `worker/`: the API (`/api/game`) and same-origin cookie identity. Google sign-in: `worker/google.ts` (OAuth, pure), `worker/accounts.ts` (D1: accounts, sessions, seat moves), `worker/auth.ts` (routes).

## Done (branch `polish-feel`)
- Sound lands with the piece (`lib/motion.ts` is the single timing source), with two-part move, capture and mate sounds.
- Lift, slide, hover and drop motion; static flat move dots; selection without the pulsing ring.

## Current task: next batch (in order, one commit each)
Lint baseline: `components/ui/*`, `captured-tray.tsx` and others already have oxlint errors. Do not fix unrelated files, but add no new errors in the files you touch.

0. **Wire up the audio test.** `tests/game-audio.test.ts` is not run by any script. Add it to an npm script (for example, extend `test:ui`) and make sure the test job in `.github/workflows/deploy.yml` runs it.
1. **Centered ink stamp** for 吃 / 将 / 绝杀 and results (`components/board-effect.tsx`, `lib/presentation.ts`, CSS):
   - Add a pure `capture` effect kind in `lib/presentation.ts` (with tests), so a capture triggers the stamp as well as the sound.
   - One stamp component: a brushed ink ring in our own SVG, a large character and a few ink dots.
     Timing is relative to the start of the move: it appears at +250 ms with scale and blur converging by ~+400 ms (when the piece lands), holds, then fades over ~400 ms.
     Capture is about 1.4 s in total; check is similar; mate is about 1.6 s.
   - **No dark veil** over the board; pieces stay visible. Keep the result text for draws, wins and timeouts readable.
   - Fonts: use the existing font stack, or an open-licensed font that is self-hosted. No external font CDN, because `/ai/` runs under COEP.
2. **Effect settings** (friend room and AI page): toggles for 音效 (already exists as `chuhan-sound`), 走子提示 (move dots), 吃子/将军动画 and 绝杀/结算动画.
   Store them in localStorage (wrap reads and writes in try/catch, so the game must work without storage). Honor `prefers-reduced-motion` by default. Keep the UI small: a compact panel, the same on both pages.
3. **Local game archive** (the start of the review feature):
   - A pure module (for example `lib/archive.ts`) that serializes a finished game: engine-notation moves (`squareToEngine` in `lib/ai-game.ts`), sides, names, result, reason, mode (AI level or friend), and date. Include round-trip tests that replay the moves with `lib/xiangqi.ts` and reach the same final board and result.
   - Storage adapter: IndexedDB, falling back to localStorage. Keep the newest 200 games. Save automatically when an AI game or a friend game ends, once per game.
   - A "最近对局" list reachable from the lobby: date, opponent, result, move count. Opening a game loads it into the `/ai/` page **review mode** (it already has step-through, try-a-branch and live engine analysis) with something like `/ai/?game=<id>`. Do not build a second replay UI.

Done means all checks pass (`typecheck`, `test`, `test:ui`, `test:mobile`, `test:ai`, `test:identity`, `build`), plus a short Chinese summary per step of what changed and what you could not verify. The real-device feel is checked by the user.
