// Premove request handler.

async function runPremove(msg) {
  if (job) job.cancelled = true;
  const mine = { cancelled: false };
  job = mine;
  const ctx = {};
  const res = await analysePremove(msg, mine, ctx);
  if (res.premove || !msg.pawnTrade || mine.cancelled || res.error || !ctx.all) return res;
  return (await pawnTradePremove(msg, mine, ctx)) || res;
}
