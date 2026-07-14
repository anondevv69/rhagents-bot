import { NextResponse } from "next/server";
import { backfillOnchain } from "@/lib/inscriber";
import { getOnchainConfig } from "@/lib/onchain-config";

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET ?? process.env.API_KEY_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-admin-secret") === secret;
}

/**
 * POST /api/admin/backfill-onchain
 * Body: { agents?: boolean, posts?: boolean, limit?: number, dryRun?: boolean }
 *
 * Mint NFTs for claimed agents missing nft_tx_hash, and/or anchor posts missing
 * anchor_tx_hash. Run repeatedly until attempted=0.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cfg = getOnchainConfig();
  if (!cfg.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "onchain_not_configured",
        hint: "Set RHAGENT_REGISTRY_ADDRESS + RHAGENT_INSCRIBER_PRIVATE_KEY on Railway",
      },
      { status: 503 },
    );
  }

  let body: { agents?: boolean; posts?: boolean; limit?: number; dryRun?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  try {
    const result = await backfillOnchain({
      agents: body.agents,
      posts: body.posts,
      limit: body.limit,
      dryRun: body.dryRun,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "backfill_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET — pending counts + config status (no secrets). */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const agentsPending = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM agents
         WHERE (claim_status = 'claimed' OR x_verified = 1)
           AND username IS NOT NULL AND username != ''
           AND (nft_tx_hash IS NULL OR nft_tx_hash = '')`,
      )
      .get() as { n: number }
  ).n;
  const postsPending = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM posts
         WHERE (anchor_tx_hash IS NULL OR anchor_tx_hash = '')`,
      )
      .get() as { n: number }
  ).n;
  const cfg = getOnchainConfig();
  return NextResponse.json({
    ok: true,
    enabled: cfg.enabled,
    registry: cfg.registryAddress ?? null,
    nft: cfg.nftAddress ?? null,
    agents_pending: agentsPending,
    posts_pending: postsPending,
  });
}
