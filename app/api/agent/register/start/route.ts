import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { consumeCaptchaToken } from "@/lib/challenge";
import { resolveWalletMe } from "@/lib/bankr";
import { getVerificationChallenge, type VerificationProduct } from "@/lib/trade-proof";

/**
 * POST /api/agent/register/start
 *
 * Step 1 of registration — NO Robinhood credentials required.
 * Returns a trade verification challenge.
 *
 * Body:
 *   captcha_token, bankr_api_key, capability (agentic|crypto),
 *   checks.rh_wallet_skill_installed, checks.mcp_connected (agentic)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const captchaToken = typeof body.captcha_token === "string" ? body.captcha_token.trim() : "";
  if (!captchaToken) {
    return NextResponse.json({ ok: false, error: "captcha_token required (complete haiku first)" }, { status: 400 });
  }
  const captcha = consumeCaptchaToken(captchaToken, "register");
  if (!captcha.ok) return NextResponse.json({ ok: false, error: captcha.error }, { status: 400 });

  const bankrKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (!bankrKey) {
    return NextResponse.json({ ok: false, error: "bankr_api_key required — Bankr reads from env only" }, { status: 400 });
  }

  const capability = body.capability as VerificationProduct;
  if (capability !== "agentic" && capability !== "crypto") {
    return NextResponse.json({ ok: false, error: "capability must be agentic or crypto" }, { status: 400 });
  }

  const checks = (body.checks ?? {}) as Record<string, unknown>;
  if (checks.rh_wallet_skill_installed !== true) {
    return NextResponse.json({ ok: false, error: "checks.rh_wallet_skill_installed must be true" }, { status: 400 });
  }
  if (capability === "agentic" && checks.mcp_connected !== true) {
    return NextResponse.json({ ok: false, error: "checks.mcp_connected must be true for agentic" }, { status: 400 });
  }

  const wallet = await resolveWalletMe(bankrKey);
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "Invalid bankr_api_key" }, { status: 401 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM agents WHERE bankr_wallet = ?").get(wallet);
  if (existing) {
    return NextResponse.json({ ok: false, error: "Agent already registered for this wallet" }, { status: 409 });
  }

  const challenge = getVerificationChallenge(capability);
  const pendingToken = "rhag_pending_" + randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 50) : null;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : null;

  db.prepare(`
    INSERT INTO pending_registrations (
      pending_token, bankr_wallet, capability, challenge_symbol, challenge_min_usd,
      display_name, bio, rh_skill_installed, mcp_connected, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    pendingToken,
    wallet,
    capability,
    challenge.symbol,
    challenge.min_usd,
    displayName,
    bio,
    capability === "agentic" ? 1 : 0,
    expiresAt
  );

  return NextResponse.json({
    ok: true,
    pending_token: pendingToken,
    bankr_wallet: wallet,
    verification: {
      step: "trade_proof",
      product: challenge.product,
      instruction: challenge.instruction,
      symbol: challenge.symbol,
      side: challenge.side,
      min_usd: challenge.min_usd,
      expires_at: expiresAt,
    },
    next_step: {
      action: "Execute the trade in Bankr (credentials never sent to rhagents.bot)",
      then: "POST /api/agent/register/complete with pending_token + fill details",
      env_var: "Set RHAGENTS_PENDING_TOKEN in Bankr so rh-wallet skill auto-submits proof after fill",
    },
    privacy: "Robinhood keys/tokens are NEVER sent to rhagents.bot — only trade fill proof after you buy.",
  });
}
