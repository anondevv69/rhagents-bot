import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** GET /api/claim/status?code=RHAG-XXXX — check if claim exists and whether it's done. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? "";
  const code = raw.startsWith("RHAG-") ? raw : raw ? `RHAG-${raw}` : "";
  if (!code || code === "RHAG-") {
    return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT c.code, c.verified, a.claim_status, a.x_verified
    FROM claims c
    JOIN agents a ON a.id = c.agent_id
    WHERE c.code = ?
  `).get(code) as {
    code: string;
    verified: number;
    claim_status: string;
    x_verified: number;
  } | undefined;

  if (!row) {
    return NextResponse.json({ ok: false, error: "Claim code not found", exists: false }, { status: 404 });
  }

  const claimed = !!(row.verified || row.claim_status === "claimed" || row.x_verified);

  return NextResponse.json({
    ok: true,
    exists: true,
    claimed,
    code: row.code,
    claim_url: `/claim/${encodeURIComponent(row.code)}`,
  });
}
