//! StockCrab · Chrome shim (content scripts)
//! Chrome has no `browser` namespace; its `chrome.*` APIs return promises in MV3, which is all the content scripts need.
//! File: platforms/chrome/browser-shim.js, loaded first in the Chrome build only.

if (typeof browser === "undefined") globalThis.browser = chrome;
