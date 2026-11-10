/*
  StockCrab single-threaded WebAssembly port of Fairy-Stockfish (GPL-3.0, like the engine).
  Browsers give an extension's background page no SharedArrayBuffer, so the search runs on the
  worker's only thread: it yields to the event loop now and then (Asyncify) to read "stop".
*/

#ifndef STOCKCRAB_SINGLE_H_INCLUDED
#define STOCKCRAB_SINGLE_H_INCLUDED

#ifdef SC_SINGLE_THREAD

#include <string>

namespace Stockfish {

// Waits (without blocking the worker) for the next UCI line posted to the worker.
std::string sc_getline();

// Lets the worker handle its messages during a search: "stop", "quit", "ponderhit", "isready".
// Without `force` it does so at most every 40 ms, so a busy search loses little time.
void sc_yield(bool force = false);

} // namespace Stockfish

#endif // SC_SINGLE_THREAD

#endif // #ifndef STOCKCRAB_SINGLE_H_INCLUDED
