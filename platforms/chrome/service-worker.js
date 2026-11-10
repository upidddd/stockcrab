// Chrome: keeps the offscreen engine document open.

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
  } finally {
    creating = null;
  }
}

chrome.runtime.onInstalled.addListener(ensureEngineHost);
chrome.runtime.onStartup.addListener(ensureEngineHost);
// Makes sure the engine host exists.
chrome.runtime.onMessage.addListener(() => {
  ensureEngineHost();
  return false;
});
chrome.runtime.onConnect.addListener(() => {
  ensureEngineHost();
});
ensureEngineHost();
