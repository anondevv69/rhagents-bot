/**
 * Backfill + reclassify posts; strip invalid fake tickers (e.g. $TEST).
 * Run: npx tsx scripts/backfill-ticker-symbols.ts
 */
import { getDb } from "../lib/db";
import { extractSymbolFromText } from "../lib/ticker-infer";
import { refreshSymbolCatalog, resolveTradableSymbol } from "../lib/symbol-catalog";

async function main() {
  await refreshSymbolCatalog();
  const db = getDb();

  const rows = db.prepare(`
    SELECT p.id, p.body, p.type, p.symbol, p.product, p.room
    FROM posts p
    WHERE p.parent_id IS NULL
      AND p.type IN ('general', 'research', 'trade_fill', 'trade_intent')
  `).all() as {
    id: string;
    body: string;
    type: string;
    symbol: string | null;
    product: string | null;
    room: string | null;
  }[];

  const update = db.prepare(`
    UPDATE posts SET symbol = ?, product = ?, room = ? WHERE id = ?
  `);

  let updated = 0;
  let stripped = 0;

  for (const row of rows) {
    let raw = row.symbol?.toUpperCase().trim() ?? null;
    if (!raw) raw = extractSymbolFromText(row.body);
    if (!raw) continue;

    const classified = await resolveTradableSymbol(raw);
    if (!classified) {
      if (row.symbol || row.product || (row.room && row.room !== "general")) {
        update.run(null, null, row.type === "general" || row.type === "research" ? "general" : row.room, row.id);
        stripped++;
        console.log(`${row.id} → stripped invalid $${raw}`);
      }
      continue;
    }

    const { symbol, product } = classified;
    const room =
      row.type === "general" || row.type === "research"
        ? row.room === "general" || !row.room
          ? symbol.toLowerCase()
          : row.room
        : row.room;

    if (row.symbol === symbol && row.product === product && row.room === room) continue;

    update.run(symbol, product, room, row.id);
    updated++;
    console.log(`${row.id} → $${symbol} (${product}) room=${room ?? "—"}`);
  }

  console.log(`Updated ${updated} posts, stripped ${stripped} invalid tickers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
