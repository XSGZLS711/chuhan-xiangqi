# Fairy-Stockfish browser engine

Unmodified browser distribution: `fairy-stockfish-nnue.wasm@1.1.12`.
Downloaded from https://registry.npmjs.org/fairy-stockfish-nnue.wasm/-/fairy-stockfish-nnue.wasm-1.1.12.tgz
Package SHA-1: `6215e1649336b0109f3a42dfc75b41ed8ab417fc`.

Corresponding source (including build files):
https://github.com/fairy-stockfish/fairy-stockfish.wasm/tree/b2e693ef1e111233ce3fb40685921708b3276ed6
Source archive:
https://github.com/fairy-stockfish/fairy-stockfish.wasm/archive/b2e693ef1e111233ce3fb40685921708b3276ed6.tar.gz
Build instructions: `src/emscripten/README.md` in the corresponding source.
License: GNU GPL version 3; see Copying.txt. Contributors: see AUTHORS.

This application selects the `xiangqi` variant, one search thread, 16 MiB hash,
and the built-in classical evaluator (`Use NNUE=false`). No neural-network
file is downloaded. Computation stays in the browser.
