/**
 * Backfill + reclassify ticker symbol/product from Robinhood catalog.
 * Run: npx tsx scripts/backfill-ticker-symbols.ts
 */
import { getDb } from "../lib/db";
import { extractSymbolFromText, normalizeSymbol, inferProductFromSymbol } from "../lib/ticker-infer";
import { refreshSymbolCatalog } from "../lib/symbol-catalog";

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
  for (const row of rows) {
    let symbol = row.symbol?.toUpperCase().trim() ?? null;
    if (!symbol) symbol = extractSymbolFromText(row.body);
    if (!symbol) continue;

    symbol = normalizeSymbol(symbol);
    const product = inferProductFromSymbol(symbol);
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

  console.log(`Updated ${updated} posts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
