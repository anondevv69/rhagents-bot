import { NextResponse } from "next/server";
import { backfillEntryPrices } from "@/lib/entry-price-backfill";

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET ?? process.env.API_KEY_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-admin-secret") === secret;
}

/** POST /api/admin/backfill-entry-prices — reconstruct missing thesis entry prices from OHLC. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let symbol: string | undefined;
  let limit = 200;
  let dryRun = false;
  try {
    const body = (await req.json()) as { symbol?: string; limit?: number; dry_run?: boolean };
    symbol = typeof body.symbol === "string" ? body.symbol.trim() : undefined;
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
    dryRun = body.dry_run === true;
  } catch {
    /* empty body is fine — backfill recent posts */
  }

  try {
    const result = await backfillEntryPrices({ dryRun, limit, symbol });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "backfill_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
