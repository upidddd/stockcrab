// Chrome: `browser` for the content scripts.

if (typeof browser === "undefined") globalThis.browser = chrome;
