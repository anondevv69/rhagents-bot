import { NextResponse } from "next/server";
import { backfillTickerSymbols } from "@/lib/backfill-tickers";

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET ?? process.env.API_KEY_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-admin-secret") === secret;
}

/** POST /api/admin/backfill-tickers — run on production (Bearer ADMIN_SECRET or API_KEY_SECRET). */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await backfillTickerSymbols();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "backfill_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
