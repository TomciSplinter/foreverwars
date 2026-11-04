// FOREVER: live war data for both factions.
// GET /api/war ->
//   { live, alliance:{mint,mc,ch,holders}, horde:{mint,mc,ch,holders}, updated }
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   ALLIANCE_MINT   contract address (mint) of the Alliance coin
//   HORDE_MINT      contract address (mint) of the Horde coin
//   HELIUS_API_KEY  free key from https://dashboard.helius.dev (for holder counts)
//
// The response is cached at Vercel's edge for 20s, so the upstream APIs are hit
// at most ~3 times a minute no matter how many people have the site open.

const PUMP = (mint) => `https://frontend-api-v3.pump.fun/coins/${mint}`;
const DEX = (mint) => `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
const HELIUS = (key) => `https://mainnet.helius-rpc.com/?api-key=${key}`;

async function getJson(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { accept: "application/json", ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function pumpMc(mint) {
  const j = await getJson(PUMP(mint));
  const mc = Number(j.usd_market_cap);
  return mc > 0 ? mc : null;
}

async function dexStats(mint) {
  const j = await getJson(DEX(mint));
  const pairs = (j.pairs || []).filter((p) => p.chainId === "solana");
  if (!pairs.length) return null;
  pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
  const p = pairs[0];
  return { mc: Number(p.marketCap || p.fdv || 0) || null, ch: p.priceChange ? Number(p.priceChange.h24) : null };
}

// Counts unique wallets holding a balance above zero.
async function holderCount(mint, key) {
  if (!key) return null;
  const owners = new Set();
  for (let page = 1; page <= 50; page++) {
    const j = await getJson(HELIUS(key), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "forever", method: "getTokenAccounts", params: { mint, page, limit: 1000 } }),
    });
    if (j.error) throw new Error("helius: " + (j.error.message || "error"));
    const list = (j.result && j.result.token_accounts) || [];
    for (const a of list) if (Number(a.amount) > 0) owners.add(a.owner);
    if (list.length < 1000) break;
  }
  return owners.size;
}

async function faction(mint, key) {
  const [pf, dx, hd] = await Promise.allSettled([pumpMc(mint), dexStats(mint), holderCount(mint, key)]);
  const p = pf.status === "fulfilled" ? pf.value : null;
  const d = dx.status === "fulfilled" ? dx.value : null;
  const h = hd.status === "fulfilled" ? hd.value : null;
  if (hd.status === "rejected") console.error("holders", mint, hd.reason && hd.reason.message);
  return { mint, mc: p || (d && d.mc) || 0, ch: d ? d.ch : null, holders: h };
}

export default async function handler(req, res) {
  const A = (process.env.ALLIANCE_MINT || "").trim();
  const H = (process.env.HORDE_MINT || "").trim();
  const key = (process.env.HELIUS_API_KEY || "").trim();

  if (!A || !H) {
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ live: false, reason: "mints not set" });
  }
  try {
    const [alliance, horde] = await Promise.all([faction(A, key), faction(H, key)]);
    const live = alliance.mc > 0 && horde.mc > 0;
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
    return res.status(200).json({ live, reason: live ? undefined : "no market data yet", alliance, horde, updated: Date.now() });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=5");
    return res.status(200).json({ live: false, reason: String((e && e.message) || e) });
  }
}
