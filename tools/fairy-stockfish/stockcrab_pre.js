// UCI over postMessage.
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
// During a search: 1 = stop, 2 = ponderhit, 0 = nothing.
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
