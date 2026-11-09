//! StockCrab · Chrome service worker
//! A Chrome service worker cannot start a Web Worker, so the engine and everything in background/ runs in an
//! offscreen document. This worker only makes sure that document exists; it never answers messages itself.
//! File: platforms/chrome/service-worker.js (the Chrome build's background).

const OFFSCREEN = "chrome/offscreen.html";
let creating = null;

async function ensureEngineHost() {
  try {
    if (await chrome.offscreen.hasDocument()) return;
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: OFFSCREEN,
        reasons: ["WORKERS"],
        justification: "Runs the Stockfish chess engine in a Web Worker",
      });
    }
    await creating;
  } catch (e) {
    // "Only a single offscreen document may be created": another call won the race, which is fine
  } finally {
    creating = null;
  }
}

chrome.runtime.onInstalled.addListener(ensureEngineHost);
chrome.runtime.onStartup.addListener(ensureEngineHost);
// A message or a port from a page wakes this worker: make sure the engine host is there. The host answers;
// returning false here tells Chrome this listener will not.
chrome.runtime.onMessage.addListener(() => {
  ensureEngineHost();
  return false;
});
chrome.runtime.onConnect.addListener(() => {
  ensureEngineHost();
});
ensureEngineHost();
