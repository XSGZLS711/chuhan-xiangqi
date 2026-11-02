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
- `worker/`: the API (`/api/game`) and same-origin cookie identity.

## Current task: polish pack (feel)
Target numbers come from frame-by-frame measurements in `research/tiantian/motion.md`; the gap table is in `research/tiantian/plan.md`.
Do them in order, one commit each.

1. **Sound** (`lib/game-audio.ts` plus the `play(kind, delay)` call sites in `app/page.tsx` and `components/ai-game.tsx`):
   - Play the move and capture sound exactly when the piece lands. Derive the delay from the motion timing constants, one source of truth, not the hard-coded `0.18`.
   - Move: a two-part wooden knock. A hit with a ~200–230 Hz body and a short ~3.5–4 kHz click (−20 dB in ~100 ms), then a lighter second tap ~55 ms later. About 250 ms in total.
   - Capture: a short rising filtered-noise whoosh leading into a heavy thwack at landing, with a brief crackle tail. About 450 ms.
   - Mate: a low drum (60–140 Hz partials, pitch sinking toward ~45 Hz), a faint metallic ring (~1.1 / 1.5 kHz) and a soft high shimmer. About 1.2 s.
2. **Motion and selection** (`app/globals.css`, `components/chess-board.tsx`):
   - Move: instant lift (scale about 1.15–1.2 plus the lift shadow), an ease-out slide of ~130–150 ms, a hover until ~240 ms, then a quick drop (~60 ms). About 300 ms in total. A capture hovers longer and lands at ~350–380 ms.
   - Selected piece: lift over ~100 ms with no pulsing ring and no sound. Switching selection drops the old piece instantly.
   - Move dots: ~20% of a cell, flat semi-transparent green (around `rgba(120,180,80,.55)`), no pop-in animation. A capture target shows the same static dot over the enemy piece instead of the pulsing red ring.
   - Respect `prefers-reduced-motion`.
3. **Stretch, only if 1–2 are done and green:** one centered ink-stamp component for 吃 / 将 / 绝杀. A brushed ring in our own SVG and a big character. It appears at +250 ms (scale plus blur converging by ~+400 ms), holds, then fades over ~400 ms. No dark veil over the board.

Done means all checks pass, plus a short Chinese summary of what changed and what you could not verify. The real-device feel is checked by the user.
