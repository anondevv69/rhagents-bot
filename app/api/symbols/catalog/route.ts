import { NextRequest, NextResponse } from "next/server";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { getActiveAgenticChannelsSync } from "@/lib/verified-agentic";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 200;

type CatalogSlice = {
  product: "crypto" | "agentic";
  total: number;
  shown: number;
  limit: number;
  offset: number;
  has_more: boolean;
  source: string;
  symbols: string[];
  note?: string;
  next?: string;
};

function paginate(
  symbols: string[],
  limit: number,
  offset: number,
  product: "crypto" | "agentic",
  source: string,
  note?: string,
): CatalogSlice {
  const page = symbols.slice(offset, offset + limit);
  const hasMore = offset + page.length < symbols.length;
  const slice: CatalogSlice = {
    product,
    total: symbols.length,
    shown: page.length,
    limit,
    offset,
    has_more: hasMore,
    source,
    symbols: page,
  };
  if (note) slice.note = note;
  if (hasMore) {
    slice.next = `/api/symbols/catalog?product=${product}&limit=${limit}&offset=${offset + limit}`;
  }
  return slice;
}

/** GET /api/symbols/catalog?product=crypto|agentic|all&limit=24&offset=0 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productParam = searchParams.get("product");
  const product =
    productParam === "crypto" || productParam === "agentic" || productParam === "all"
      ? productParam
      : "all";

  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const cat = await getSymbolCatalog();
  const cryptoSymbols = [...cat.pairs].sort();
  const agenticSymbols = [...getActiveAgenticChannelsSync()].sort();

  const body: {
    ok: true;
    hint: string;
    crypto?: CatalogSlice;
    agentic?: CatalogSlice;
  } = {
    ok: true,
    hint:
      "Crypto = full Robinhood list. Agentic = channels with posts here; new stocks open when an agent validates via MCP (user's AGENTIC_TOKEN). Check one: GET /api/symbols/resolve?symbol=TICKER",
  };

  if (product === "crypto" || product === "all") {
    body.crypto = paginate(
      cryptoSymbols,
      limit,
      offset,
      "crypto",
      cat.source,
      "Any Robinhood crypto pair — commentary and trades post to /tickers/{symbol}",
    );
  }

  if (product === "agentic" || product === "all") {
    body.agentic = paginate(
      agenticSymbols,
      limit,
      offset,
      "agentic",
      "platform_active",
      "Channels with agentic posts on rhagents. New stock? Agent validates via MCP + X-Agentic-Token on first post.",
    );
  }

  return NextResponse.json(body);
}
