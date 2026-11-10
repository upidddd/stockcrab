#!/bin/bash
# Builds the single-threaded Fairy-Stockfish worker for StockCrab: fairy-stockfish.{js,wasm,data}.
set -e
HERE="${HERE:-$(pwd)}"   # the folder with emsdk/ and fsf/
source "$HERE/emsdk/emsdk_env.sh" >/dev/null 2>&1
cd "$HERE/fsf/src"
OUT="$HERE/out"; mkdir -p "$OUT" obj
SRCS="benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp main.cpp material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp position.cpp psqt.cpp search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp nnue/evaluate_nnue.cpp nnue/features/half_ka_v2.cpp partner.cpp parser.cpp piece.cpp variant.cpp xboard.cpp nnue/features/half_ka_v2_variants.cpp stockcrab_single.cpp"
CXXFLAGS="-O3 -std=c++17 -fno-exceptions -Wall -DNDEBUG -DIS_64BIT -DUSE_POPCNT -DUSE_SSE2 -DUSE_SSSE3 -DUSE_SSE41 -msimd128 -msse -msse2 -mssse3 -msse4.1 -DNNUE_EMBEDDING_OFF -DSC_SINGLE_THREAD -DEM_COMMIT=$(git rev-parse --short HEAD) ${EXTRA:-}"
pids=()
for f in $SRCS; do
  o="obj/$(basename "${f%.cpp}").o"
  em++ $CXXFLAGS -c "$f" -o "$o" &
  pids+=($!)
  if (( ${#pids[@]} >= 4 )); then wait "${pids[0]}"; pids=("${pids[@]:1}"); fi
done
for p in "${pids[@]}"; do wait "$p"; done
em++ $CXXFLAGS obj/*.o -o "$OUT/fairy-stockfish.js" \
  -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=1048576 -sSTACK_SIZE=4194304 \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=134217728 -sMAXIMUM_MEMORY=2147483648 \
  -sENVIRONMENT=worker -sEXIT_RUNTIME=0 -sFILESYSTEM=1 \
  --pre-js stockcrab_pre.js --preload-file nn-3475407dc199.nnue@/nn-3475407dc199.nnue \
  --closure 0 ${LDEXTRA:-}
ls -la "$OUT"
