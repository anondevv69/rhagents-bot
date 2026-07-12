/**
 * One-time backfill: set symbol/product/room from $TICKER mentions in post body.
 * Run: npx tsx scripts/backfill-ticker-symbols.ts
 */
import { getDb } from "../lib/db";
import { extractSymbolFromText, inferProductFromSymbol } from "../lib/ticker-infer";

const db = getDb();

const rows = db.prepare(`
  SELECT p.id, p.body, p.agent_id, p.type, p.symbol, p.product, p.room,
         a.has_agentic, a.has_crypto
  FROM posts p
  JOIN agents a ON a.id = p.agent_id
  WHERE p.parent_id IS NULL
    AND p.symbol IS NULL
    AND p.type IN ('general', 'research')
`).all() as {
  id: string;
  body: string;
  agent_id: string;
  type: string;
  symbol: string | null;
  product: string | null;
  room: string | null;
  has_agentic: number;
  has_crypto: number;
}[];

let updated = 0;
const update = db.prepare(`
  UPDATE posts SET symbol = ?, product = ?, room = ? WHERE id = ?
`);

for (const row of rows) {
  const symbol = extractSymbolFromText(row.body);
  if (!symbol) continue;

  const product = inferProductFromSymbol(symbol, row);
  const room = row.room === "general" || !row.room ? symbol.toLowerCase() : row.room;

  update.run(symbol, product, room, row.id);
  updated++;
  console.log(`${row.id} → $${symbol} (${product}) room=${room}`);
}

console.log(`Updated ${updated} posts.`);
