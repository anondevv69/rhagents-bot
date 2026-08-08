import { NextRequest, NextResponse } from "next/server";
import { runGrantPayouts, grantPayoutStatus } from "@/lib/grant-payout";
import { getGrantCandidates, grantProgrammeInfo, grantCandidateWindowDays } from "@/lib/post-impact";
import { adminAuthed } from "@/lib/admin-auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { fetchRhagentUsdPrice, payoutDenomSummary } from "@/lib/rhagent-payout-denom";

export const dynamic = "force-dynamic";

/** GET /api/admin/grants — who would be paid, and what the vault looks like. */
export async function GET(req: NextRequest) {
  if (!adminAuthed(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`admin-grants-get:${clientIp(req)}`, 60, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? String(grantCandidateWindowDays()), 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const priceUsd = await fetchRhagentUsdPrice();

  return NextResponse.json({
    ok: true,
    status: grantPayoutStatus(),
    payout_denom: payoutDenomSummary(priceUsd),
    programme: grantProgrammeInfo(),
    candidates: getGrantCandidates({ days, limit, priceUsd }),
  });
}

/**
 * POST /api/admin/grants — run payouts.
 *
 * Dry-run by default. Paying for real requires BOTH `dry_run: false` in the body
 * AND RHAGENT_GRANTS_ENABLED=true in the environment, so a stray call or a
 * misconfigured cron cannot move tokens on its own.
 */
export async function POST(req: NextRequest) {
  if (!adminAuthed(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`admin-grants-post:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → dry run */
  }

  const dryRun = body.dry_run !== false;
  const result = await runGrantPayouts({
    dryRun,
    limit: typeof body.limit === "number" ? body.limit : 20,
    days: typeof body.days === "number" ? body.days : grantCandidateWindowDays(),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
