// StockCrab: single-threaded Fairy-Stockfish for the browser (GPL-3.0).

#ifdef SC_SINGLE_THREAD

#include <cstdlib>
#include <emscripten.h>

#include "misc.h"
#include "stockcrab_single.h"
#include "thread.h"

EM_JS_DEPS(stockcrab, "$stringToNewUTF8");

EM_ASYNC_JS(char*, sc_next_line, (), {
  return stringToNewUTF8(await Module.scNext());
});

EM_JS(int, sc_poll, (), {
  return Module.scPoll();
});

namespace Stockfish {

std::string sc_getline() {

  char* line = sc_next_line();
  std::string s(line);
  free(line);
  return s;
}

void sc_yield(bool force) {

  static TimePoint last = 0;
  TimePoint t = now();
  if (!force && t - last < 40)
      return;
  last = t;
  emscripten_sleep(0);
  for (int r; (r = sc_poll()); )
      if (r == 1)
          Threads.stop = true;
      else if (r == 2 && Threads.size())
          Threads.main()->ponder = false;
}

} // namespace Stockfish

#endif // SC_SINGLE_THREAD
