Fairy-Stockfish for StockCrab

Fairy-Stockfish by Fabian Fichter and contributors (GPL-3.0, see COPYING.txt),
https://github.com/fairy-stockfish/Fairy-Stockfish, commit 4e3d014, built single-threaded for the
browser with Emscripten (an extension's background page has no SharedArrayBuffer, so the published
multi-threaded build cannot run there). The search yields to the worker's event loop every 40 ms to
read "stop". fairy-stockfish.data holds the NNUE network nn-3475407dc199.nnue (Stockfish's, GPL-3.0).
The build script and the small patch are in tools/fairy-stockfish/ of the repository.
