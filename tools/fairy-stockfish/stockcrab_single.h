// StockCrab: single-threaded Fairy-Stockfish for the browser (GPL-3.0).

#ifndef STOCKCRAB_SINGLE_H_INCLUDED
#define STOCKCRAB_SINGLE_H_INCLUDED

#ifdef SC_SINGLE_THREAD

#include <string>

namespace Stockfish {

// Next UCI line posted to the worker.
std::string sc_getline();

// Handles stop/ponderhit/isready during a search.
void sc_yield(bool force = false);

} // namespace Stockfish

#endif // SC_SINGLE_THREAD

#endif // #ifndef STOCKCRAB_SINGLE_H_INCLUDED
