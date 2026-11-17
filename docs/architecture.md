# How StockCrab is put together

The extension lives in [`src/stockcrab/`](../src/stockcrab). That folder is what Firefox loads (`manifest.json` is at its top).
There is no bundler and no build step: every file is a plain script, and `manifest.json` lists them in the order they load.
All the content scripts share **one global scope** (so do all the background scripts), which is why a function in one file
can call a function in another. Load order matters only for code that runs the moment a file loads; everything else runs later.

```
src/stockcrab/
├── manifest.json
├── build.js                which build this is: the full one or StockCrab Lite (loaded first, on the page and in the background)
├── assets/                 the extension's own icon (logo) in the sizes Firefox wants
├── content/                runs on chess.com and lichess pages
│   ├── core/               constants, hold tracker, settings, main loop, entry point
│   ├── board/              finding the board and reading the position
│   ├── hints/              turning engine answers into marks, and drawing them
│   └── ui/                 the panel and its status line
├── background/             hosts the engine (an event page)
│   ├── engine/             the registry, the search, the queue, boot and recovery
│   └── premove/            premove analysis and the pawn-trade rule
└── engine/                 the engines: Stockfish builds, fairy/ (Fairy-Stockfish), maia/ (Maia 3 as a UCI worker), licences
```

## Components

Names used in the README, in the code headers (the one-line comment at the top of every file) and here.

### Content scripts, in load order

| # | Component | File | What it does |
|---|---|---|---|
| 1 | Build flag | `build.js` | `BUILD`: `"desktop"` or `"mobile"` (StockCrab Lite) |
| 2 | Constants | `content/core/constants.js` | panel id, mark class, logo, which site this is |
| 3 | Hold tracker | `content/core/hold.js` | knows when a piece is in the user's hand |
| 4 | Board finder | `content/board/find.js` | the game's board element |
| 5 | Settings | `content/core/settings.js` | defaults (smaller ones in Lite), shared state, saving |
| 6 | Orientation | `content/board/orientation.js` | which colour is at the bottom, which colour the user plays |
| 7 | Board reader | `content/board/reader.js` | reads the position (chess.com), repairs the side to move, legality checks |
| 8 | Lichess reader | `content/board/lichess.js` | reads the position from chessground |
| 9 | Move finder | `content/board/moves.js` | plays a move on a board map, finds which move led from one position to the next |
| 10 | Hint painter | `content/hints/draw.js` | arrows, outlines, cards, the dashed threat arrow, the blur layer |
| 11 | Score text | `content/hints/score.js` | how a score is written (pawns, centipawns, win chance) |
| 12 | Mark builder | `content/hints/marks.js` | engine answer → marks to draw; the best line as text; the threat position |
| 13 | Evaluation bar | `content/hints/evalbar.js` | White's winning chances beside the board |
| 14 | Status line and move list | `content/ui/status.js` | the line and the list in the panel |
| 15 | Show and rerender | `content/hints/show.js` | draws and lists marks; redraws after a look setting changes |
| 16 | Main loop | `content/core/tick.js` | every 250 ms: read, ask, draw; the threat search; retry after a failure |
| 17 | Panel | `content/ui/panel.js` | the settings panel and the HUD (shadow DOM); the bottom sheet in Lite |
| 18 | Cursor trail | `content/ui/trail.js` | a ribbon behind the mouse pointer |
| 19 | Entry point | `content/core/main.js` | loads the saved settings, the hotkey, the timers |

### Background scripts, in load order

| # | Component | File | What it does |
|---|---|---|---|
| 1 | Build flag | `build.js` | `BUILD`: `"desktop"` or `"mobile"` (StockCrab Lite) |
| 2 | Engine registry | `background/engine/models.js` | the engine builds (only the small ones in Lite), the state of the running engine |
| 3 | Aggression picker | `background/engine/aggression.js` | a sharper move among nearly equal ones |
| 4 | Strength | `background/engine/strength.js` | the Elo scale 200 – 3800: the engine's own limit, the pick below it, the node budget above it |
| 5 | UCI line builder | `background/engine/uci-lines.js` | exact scores only, lines from the last complete depth |
| 6 | Search runner | `background/engine/search.js` | one search: options, position, `go`, the answer |
| 7 | Engine boot and recovery | `background/engine/boot.js` | starts the worker, falls back, restarts after a crash |
| 8 | Search queue | `background/engine/queue.js` | one search at a time, a newer request replaces the waiting one |
| 9 | Premove analyst | `background/premove/analysis.js` | the reply worth premoving (safe, likely, smart) |
| 10 | Pawn-trade rule | `background/premove/pawn-trades.js` | the rule-based pawn retake |
| 11 | Premove runner | `background/premove/run.js` | one premove request |
| 12 | Opening book | `background/book.js` | book moves of the chosen opening (`assets/openings.json`), checked against the engine |
| 13 | Update checker | `background/updates.js` | the latest GitHub release; Firefox installs it through `update_url` |
| 14 | Message router | `background/main.js` | switches engines, answers the content scripts, keeps the page alive |

## How a hint happens

1. **Main loop** (`tick`) wakes up every 250 ms. If a piece is held (**Hold tracker**) it waits.
2. **Board finder** and **Board reader** (or **Lichess reader**) produce a FEN. **Orientation** says whether it is the user's turn.
   A position has to stay the same for two ticks before it is used.
3. The loop sends a message to the **Message router**: `hint` (my turn) or `premove` (their turn).
4. The router passes it to the **Search queue**, the **Search runner** talks UCI to the engine worker, the **UCI line builder**
   turns the engine's `info` lines into the answer, and the answer goes back.
5. **Mark builder** makes marks out of it, **Hint painter** draws them, and the **Panel** lists them.

Messages from the content scripts to the background: `status`, `engine` (switch model), `hint` (with `opening` it goes through the **Opening book**), `premove`, `openings` (names for the panel), `options` (the engine options a model reported), `update` and `install-update`.

## Adding or moving a file

1. Put the script in the right folder and give it a one-line comment at the top saying what it is for.
2. Add it to `manifest.json` (`content_scripts[0].js` or `background.scripts`) at the right place in the load order.
3. Run `python3 tools/check.py`. It fails if a script is missing from the manifest or the manifest names a file that is not there.

Top-level code that runs at load time belongs in the entry points (`content/core/main.js`, `background/main.js`, and
`engine/boot.js` for the engine start), because they load last, when everything else exists.

## Chrome

The Chrome version is built from the same files by `packaging/build_chrome.py` into `dist/chrome/`. Only the glue in
[`platforms/chrome/`](../platforms/chrome) is Chrome's own:

| Component | File | What it does |
|---|---|---|
| Chrome shim (content scripts) | `platforms/chrome/browser-shim.js` | `browser` = `chrome` (MV3 `chrome.*` calls return promises) |
| Chrome service worker | `platforms/chrome/service-worker.js` | the background; only makes sure the engine host exists |
| Engine host | `chrome/offscreen.html` (generated) | an offscreen document that loads every file of `background/`, in the manifest's order |
| Chrome shim (engine host) | `platforms/chrome/offscreen-shim.js` | `browser.runtime` for the background scripts; turns their returned promises into `sendResponse` |
| chess.com position bridge | `platforms/chrome/page-fen.js` | a MAIN-world script that publishes the game's FEN (Chrome has no `wrappedJSObject`) |

Why: a Chrome MV3 background is a service worker, and a service worker cannot start the Web Worker the engine runs in.
An offscreen document can. Messages from the page reach both; the service worker never answers, the engine host does.
If a message arrives before the engine host exists, it fails and the main loop asks again a moment later.

The blur under the hints uses plain boxes (four bars for an outline, a turned bar for the shaft, slices for the head,
rounded boxes for cards), never `clip-path`: Chromium ignores `clip-path` on a `backdrop-filter` as soon as an
ancestor clips with rounded corners, and chess.com's board does.

## StockCrab Lite

`packaging/build_mobile.py` copies the extension to `dist/mobile/` with only the engine files of the models marked
`mobile: true` in `background/engine/models.js`, rewrites `build.js` to `const BUILD = "mobile";` and gives the add-on
its own id (`stockcrab-lite@local`), so it installs next to the full version and updates from the same `updates.json`.
With `BUILD === "mobile"` the registry drops the other models, the defaults are lighter (Stockfish 19 Lite, 3 s, 32 MB,
no blur), the panel is a sheet along the bottom of the screen that starts folded, and the controls marked `desktop: true`
(cursor trail, HUD, hotkey, corner, blur) are left out. `--chrome` also builds it for Chromium.

## Packing

`python3 packaging/build_xpi.py` writes `dist/stockcrab-<version>.xpi`, `python3 packaging/build_chrome.py` writes `dist/chrome/`
and `dist/stockcrab-chrome-<version>.zip`, `python3 packaging/build_mobile.py --chrome` writes `dist/stockcrab-lite-<version>.xpi`
and `dist/stockcrab-lite-chrome-<version>.zip`. The GitHub workflow in `.github/workflows/build.yml` runs the check and every
packing on every push, and attaches the files to the release when a `v*` tag is pushed.
