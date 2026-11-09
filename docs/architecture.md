# How StockCrab is put together

The extension lives in [`src/stockcrab/`](../src/stockcrab). That folder is what Firefox loads (`manifest.json` is at its top).
There is no bundler and no build step: every file is a plain script, and `manifest.json` lists them in the order they load.
All the content scripts share **one global scope** (so do all the background scripts), which is why a function in one file
can call a function in another. Load order matters only for code that runs the moment a file loads; everything else runs later.

```
src/stockcrab/
├── manifest.json
├── assets/                 the extension's own icon (logo) in the sizes Firefox wants
├── content/                runs on chess.com and lichess pages
│   ├── core/               constants, hold tracker, settings, main loop, entry point
│   ├── board/              finding the board and reading the position
│   ├── hints/              turning engine answers into marks, and drawing them
│   ├── rating/             the kinds of move and how a move is classified
│   └── ui/                 the panel and its status line
├── background/             hosts the engine (an event page)
│   ├── engine/             the registry, the search, the queue, boot and recovery
│   └── premove/            premove analysis and the pawn-trade rule
├── data/opening-book.js    7,981 opening positions (hashes) for the Book rating
├── engine/                 Stockfish builds and their licences
└── icons/                  optional: the user's own move icons
```

## Components

Names used in the README, in the code headers (the `//!` lines at the top of every file) and here.

### Content scripts, in load order

| # | Component | File | What it does |
|---|---|---|---|
| 1 | Opening book (data) | `data/opening-book.js` | the set of opening positions |
| 2 | Constants | `content/core/constants.js` | panel id, mark class, logo, which site this is |
| 3 | Hold tracker | `content/core/hold.js` | knows when a piece is in the user's hand |
| 4 | Board finder | `content/board/find.js` | the game's board element |
| 5 | Settings | `content/core/settings.js` | defaults, shared state, saving |
| 6 | Orientation | `content/board/orientation.js` | which colour is at the bottom, which colour the user plays |
| 7 | Board reader | `content/board/reader.js` | reads the position (chess.com), repairs the side to move, legality checks |
| 8 | Lichess reader | `content/board/lichess.js` | reads the position from chessground |
| 9 | Hint painter | `content/hints/draw.js` | arrows, outlines, cards, icons, the blur layer |
| 10 | Rating kinds | `content/rating/kinds.js` | the kinds of move, their colours, the win-chance formula |
| 11 | Icon kit | `content/hints/icons.js` | built-in vector icons and the user's icon files |
| 12 | Sacrifice detector | `content/rating/sacrifice.js` | is a piece really given up (Brilliant) |
| 13 | Opening book (rating) | `content/rating/book.js` | is the position after a move theory |
| 14 | Move classifier | `content/rating/classify.js` | Great, Miss, the classifier, score text |
| 15 | Mark builder | `content/hints/marks.js` | engine answer → marks to draw |
| 16 | Status line and move list | `content/ui/status.js` | the line and the list in the panel |
| 17 | Played-move rater | `content/rating/played-move.js` | rates the move the user just played; show and rerender |
| 18 | Main loop | `content/core/tick.js` | every 250 ms: read, ask, draw; retry after a failure |
| 19 | Panel | `content/ui/panel.js` | the settings panel (shadow DOM) |
| 20 | Entry point | `content/core/main.js` | loads the saved settings, the hotkey, the timers |

### Background scripts, in load order

| # | Component | File | What it does |
|---|---|---|---|
| 1 | Engine registry | `background/engine/models.js` | the engine builds, the state of the running engine |
| 2 | Aggression picker | `background/engine/aggression.js` | a sharper move among nearly equal ones |
| 3 | UCI line builder | `background/engine/uci-lines.js` | exact scores only, lines from the last complete depth |
| 4 | Search runner | `background/engine/search.js` | one search: options, position, `go`, the answer |
| 5 | Engine boot and recovery | `background/engine/boot.js` | starts the worker, falls back, restarts after a crash |
| 6 | Search queue | `background/engine/queue.js` | one search at a time, a newer request replaces the waiting one |
| 7 | Premove analyst | `background/premove/analysis.js` | the reply worth premoving (safe, likely, smart) |
| 8 | Pawn-trade rule | `background/premove/pawn-trades.js` | the rule-based pawn retake |
| 9 | Premove runner | `background/premove/run.js` | one premove request |
| 10 | Message router | `background/main.js` | switches engines, answers the content scripts, keeps the page alive |

## How a hint happens

1. **Main loop** (`tick`) wakes up every 250 ms. If a piece is held (**Hold tracker**) it waits.
2. **Board finder** and **Board reader** (or **Lichess reader**) produce a FEN. **Orientation** says whether it is the user's turn.
   A position has to stay the same for two ticks before it is used.
3. The loop sends a message to the **Message router**: `hint` (my turn) or `premove` (their turn).
4. The router passes it to the **Search queue**, the **Search runner** talks UCI to the engine worker, the **UCI line builder**
   turns the engine's `info` lines into the answer, and the answer goes back.
5. **Mark builder** makes marks out of it, **Move classifier** rates them, **Hint painter** draws them, and the **Panel** lists them.
6. When the user then plays a move, **Played-move rater** works out which move it was from the two positions and rates it
   (asking the router for a `rate` search if the move was not among the hint's lines).

Messages from the content scripts to the background: `status`, `engine` (switch model), `hint`, `premove`, `rate`.

## Adding or moving a file

1. Put the script in the right folder and give it a `//!` header (name, one line, its path).
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
rounded boxes for cards and icons), never `clip-path`: Chromium ignores `clip-path` on a `backdrop-filter` as soon as an
ancestor clips with rounded corners, and chess.com's board does.

## Packing

`python3 packaging/build_xpi.py` writes `dist/stockcrab-<version>.xpi`, `python3 packaging/build_chrome.py` writes `dist/chrome/`
and `dist/stockcrab-chrome-<version>.zip`. The GitHub workflow in `.github/workflows/build.yml` runs the check and both
packings on every push, and attaches both files to the release when a `v*` tag is pushed.
