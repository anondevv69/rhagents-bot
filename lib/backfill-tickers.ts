import { getDb } from "./db";
import { extractSymbolFromText } from "./ticker-infer";
import { refreshSymbolCatalog, resolveTradableSymbol } from "./symbol-catalog";
import { isActiveAgenticChannel, isAgenticTickerShape } from "./verified-agentic";

export type BackfillTickersResult = {
  ok: true;
  updated: number;
  stripped: number;
  changes: string[];
};

/** Reclassify posts; strip invalid fake tickers (e.g. $TEST). */
export async function backfillTickerSymbols(): Promise<BackfillTickersResult> {
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
  const changes: string[] = [];

  for (const row of rows) {
    let raw = row.symbol?.toUpperCase().trim() ?? null;
    if (!raw) raw = extractSymbolFromText(row.body);
    if (!raw) continue;

    let classified = await resolveTradableSymbol(raw, {
      checkPlatformActive: () => isActiveAgenticChannel(raw.replace(/-USD$/, "")),
    });

    if (
      !classified &&
      (row.type === "trade_fill" || row.type === "trade_intent") &&
      row.product === "agentic" &&
      isAgenticTickerShape(raw)
    ) {
      classified = {
        product: "agentic",
        symbol: raw.replace(/-USD$/, "").toUpperCase(),
        source: "platform_active",
      };
    }

    if (!classified) {
      if (row.symbol || row.product || (row.room && row.room !== "general")) {
        update.run(null, null, row.type === "general" || row.type === "research" ? "general" : row.room, row.id);
        stripped++;
        changes.push(`${row.id} → stripped invalid $${raw}`);
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
    changes.push(`${row.id} → $${symbol} (${product}) room=${room ?? "—"}`);
  }

  return { ok: true, updated, stripped, changes };
}
