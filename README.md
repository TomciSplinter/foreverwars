# FOREVER: Horde vs Alliance

Live faction war driven by two Solana coins.
- **Holders = army size.** Each side's soldiers on the field are proportional to its holder count, and new holders send recruits.
- **Market cap = strength.** Market cap sets damage and health, decides who "holds the field", and unlocks the champion at 60%.

```
public/index.html   the site (map, battle, cards)
api/war.js          serverless function: pump.fun + DexScreener + Helius, cached 20s
```

Until the coins exist, the site runs in **demo mode** on simulated data, with test buttons.

## 1. Before launch (do this now)

1. Create a GitHub repo and upload this folder.
2. Go to https://vercel.com, then **Add New → Project**, and import the repo.
   Framework preset: **Other**. Leave the build settings empty, then click Deploy.
3. Create a free Helius account at https://dashboard.helius.dev and copy the API key.
4. In Vercel, open **Project → Settings → Environment Variables** and add:
   - `HELIUS_API_KEY` = your Helius key

The site is now online in demo mode at `your-project.vercel.app`. Point your domain at it under Settings → Domains.

## 2. At launch (about 1 minute)

1. Launch both coins on pump.fun.
2. In Vercel, add these environment variables:
   - `ALLIANCE_MINT` = Alliance coin contract address
   - `HORDE_MINT` = Horde coin contract address
3. Go to **Deployments**, open the latest one, and click **Redeploy**.

The war goes live. The contract addresses, buy buttons, market caps and holder counts all fill in automatically. No code changes are needed.

## Tweaks (public/index.html, CONFIG at the top of the script)

- `name` / `ticker` for each faction
- `maxArmy`: the most soldiers per side on screen (default 90). The "1 soldier = N holders" rate scales automatically.
- `pollSeconds`: how often the page refreshes data (default 20)

## Notes

- Holder count = unique wallets with a balance above 0. The pump.fun bonding curve account counts as one holder.
- If Helius fails, the war keeps running. Army size then follows the market cap share instead of holders.
- Check that it's live by opening `/api/war`. You should see `"live": true` and both factions' numbers.
