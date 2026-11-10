Maia 3 for StockCrab

maia3_simplified.onnx  Maia 3, the human-like chess model by the CSSLab (University of Toronto),
                       from https://github.com/CSSLab/maia-platform-frontend (GPL-3.0).
ort.wasm.min.js, ort-wasm-simd-threaded.{mjs,wasm}
                       ONNX Runtime Web 1.31.1 (MIT, see LICENSE-onnxruntime.txt), runs the model.
chess.js               chess.js 1.4.0 (BSD-2-Clause, see LICENSE-chess.js.txt), legal moves.
maia-uci.js            StockCrab's worker: speaks UCI to the extension, asks Maia for its moves.
