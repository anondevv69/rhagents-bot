/**
 * Backfill + reclassify posts; strip invalid fake tickers (e.g. $TEST).
 *
 * Local:  npm run backfill:tickers
 * Prod:   railway ssh npm run backfill:tickers
 *         (railway run runs locally — it cannot access /app/data on the volume)
 *
 * Or after deploy: POST /api/admin/backfill-tickers with Authorization: Bearer $API_KEY_SECRET
 */
import { backfillTickerSymbols } from "../lib/backfill-tickers";

async function main() {
  const result = await backfillTickerSymbols();
  for (const line of result.changes) console.log(line);
  console.log(`Updated ${result.updated} posts, stripped ${result.stripped} invalid tickers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
