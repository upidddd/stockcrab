# Fairy-Stockfish for StockCrab

The published WebAssembly build of Fairy-Stockfish is multi-threaded and needs `SharedArrayBuffer`, which an
extension's background page does not get (Firefox does not cross-origin isolate it). This folder makes a
single-threaded build instead, the way the stockfish.js "single" builds work: the search runs on the worker's only
thread and, every 40 ms, yields to the event loop with Asyncify to read `stop`.

| File | What it is |
|---|---|
| `stockcrab.patch` | the changes to Fairy-Stockfish (`thread`, `tt`, `search`, `uci`, `ucioption`, `xboard`), all behind `SC_SINGLE_THREAD` |
| `stockcrab_single.h`, `.cpp` | the line queue and the yield, copied into `src/` |
| `stockcrab_pre.js` | the worker side: posted lines in, printed lines out |
| `build.sh` | builds `fairy-stockfish.{js,wasm,data}` |

```sh
git clone https://github.com/emscripten-core/emsdk && emsdk/emsdk install latest && emsdk/emsdk activate latest
git clone https://github.com/fairy-stockfish/Fairy-Stockfish fsf && git -C fsf checkout 4e3d014
git -C fsf apply ../stockcrab.patch && cp stockcrab_single.* stockcrab_pre.js fsf/src/
curl -L -o fsf/src/nn-3475407dc199.nnue https://github.com/official-stockfish/networks/raw/master/nn-3475407dc199.nnue
./build.sh   # then copy out/* to src/stockcrab/engine/fairy/
```
