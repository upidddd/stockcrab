// Chrome: `browser.runtime` for the background scripts in the offscreen document.

globalThis.browser = {
  runtime: {
    getURL: (path) => chrome.runtime.getURL(path),
    getPlatformInfo: () => Promise.resolve({}),
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
            return true;
          }
          if (result !== undefined) sendResponse(result);
          return false;
        });
      },
    },
  },
};
