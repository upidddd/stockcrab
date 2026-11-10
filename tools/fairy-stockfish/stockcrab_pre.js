// StockCrab: a plain UCI worker. Lines come in with postMessage and go out with postMessage.
Module["print"] = (line) => postMessage(line);
Module["printErr"] = (line) => postMessage("info string " + line);
var scQueue = [];
var scWake = null;
self.onmessage = (e) => {
  for (const line of String(e.data).split("\n")) scQueue.push(line);
  if (scWake) {
    const wake = scWake;
    scWake = null;
    wake();
  }
};
Module["scNext"] = () => (scQueue.length ? Promise.resolve(scQueue.shift()) : new Promise((r) => (scWake = r)).then(() => scQueue.shift()));
// During a search: 1 = stop (or quit), 2 = ponderhit, 0 = nothing more. "isready" at the front is answered at once;
// any other command waits until the search ends, as the host never sends one mid-search.
Module["scPoll"] = () => {
  while (scQueue.length && /^\s*isready\s*$/.test(scQueue[0])) {
    scQueue.shift();
    postMessage("readyok");
  }
  for (let i = 0; i < scQueue.length; i++) {
    const t = scQueue[i].trim().split(/\s+/)[0];
    if (t === "stop" || t === "quit") return scQueue.splice(i, 1), 1;
    if (t === "ponderhit") return scQueue.splice(i, 1), 2;
  }
  return 0;
};
