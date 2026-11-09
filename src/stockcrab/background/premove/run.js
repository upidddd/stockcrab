//! StockCrab · Premove runner
//! Runs the premove analysis and the pawn-trade rule for one request.
//! File: background/premove/run.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

async function runPremove(msg) {
  if (job) job.cancelled = true;
  const mine = { cancelled: false };
  job = mine;
  const ctx = {};
  const res = await analysePremove(msg, mine, ctx);
  if (res.premove || !msg.pawnTrade || mine.cancelled || res.error || !ctx.all) return res;
  return (await pawnTradePremove(msg, mine, ctx)) || res;
}
