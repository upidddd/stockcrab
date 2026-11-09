//! StockCrab · Chrome shim (engine host)
//! The background scripts run in an offscreen document on Chrome. This gives them the `browser.runtime` they expect:
//! Chrome's onMessage cannot answer with a returned promise, so the answer is passed to sendResponse instead.
//! File: platforms/chrome/offscreen-shim.js, loaded first in chrome/offscreen.html.

globalThis.browser = {
  runtime: {
    getURL: (path) => chrome.runtime.getURL(path),
    getPlatformInfo: () => Promise.resolve({}), // only used as a keep-alive in Firefox; an offscreen document stays alive
    onConnect: chrome.runtime.onConnect,
    onMessage: {
      addListener(listener) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          let result;
          try {
            result = listener(msg, sender);
          } catch (e) {
            sendResponse({ id: msg && msg.id, move: null, error: String(e) });
            return false;
          }
          if (result && typeof result.then === "function") {
            result.then(sendResponse, (e) => sendResponse({ id: msg && msg.id, move: null, error: String(e) }));
            return true; // the answer comes later
          }
          if (result !== undefined) sendResponse(result);
          return false;
        });
      },
    },
  },
};
