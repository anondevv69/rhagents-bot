import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { consumeCaptchaToken } from "@/lib/challenge";
import { resolveWalletMe } from "@/lib/bankr";
import { getVerificationChallenge, type VerificationProduct } from "@/lib/trade-proof";
import { SETUP_REQUIRED_RESPONSE, VERIFICATION_TIMING, RH_WALLET_SETUP } from "@/lib/setup";

/**
 * POST /api/agent/register/start
 *
 * Step 1 — haiku done, now assign verification trade challenge.
 * Works for ANY agent runtime (Bankr, custom, etc.) — bankr_api_key is optional.
 *
 * Body:
 *   captcha_token     — required (haiku verification)
 *   capability        — "agentic" | "crypto"
 *   can_execute_trade — if false, returns setup redirect (no pending token)
 *   bankr_api_key     — optional (links Bankr wallet if present)
 *   display_name      — optional agent name
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
    return NextResponse.json(
      { ok: false, error: "captcha_token required — complete haiku verification first" },
      { status: 400 }
    );
  }
  const captcha = consumeCaptchaToken(captchaToken, "register");
  if (!captcha.ok) return NextResponse.json({ ok: false, error: captcha.error }, { status: 400 });

  // Agent says they cannot trade yet → redirect to rh-wallet setup
  if (body.can_execute_trade === false) {
    return NextResponse.json(
      {
        ...SETUP_REQUIRED_RESPONSE,
        capability: body.capability ?? null,
      },
      { status: 200 }
    );
  }

  const capability = body.capability as VerificationProduct;
  if (capability !== "agentic" && capability !== "crypto") {
    return NextResponse.json(
      {
        ok: false,
        error: "capability required: 'agentic' or 'crypto'",
        setup: RH_WALLET_SETUP,
      },
      { status: 400 }
    );
  }

  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 50) : null;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : null;

  // Optional Bankr wallet link — not required for all agents
  let wallet: string | null = null;
  const bankrKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (bankrKey) {
    wallet = await resolveWalletMe(bankrKey);
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "Invalid bankr_api_key" }, { status: 401 });
    }
    const db = getDb();
    const existing = db.prepare("SELECT id FROM agents WHERE bankr_wallet = ?").get(wallet);
    if (existing) {
      return NextResponse.json({ ok: false, error: "Agent already registered for this wallet" }, { status: 409 });
    }
  }

  const challenge = getVerificationChallenge(capability);
  const pendingToken = "rhag_pending_" + randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  getDb()
    .prepare(
      `
    INSERT INTO pending_registrations (
      pending_token, bankr_wallet, capability, challenge_symbol, challenge_min_usd,
      display_name, bio, rh_skill_installed, mcp_connected, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `
    )
    .run(
      pendingToken,
      wallet,
      capability,
      challenge.symbol,
      challenge.min_usd,
      displayName,
      bio,
      expiresAt
    );

  return NextResponse.json({
    ok: true,
    agent_verified: { haiku: true },
    pending_token: pendingToken,
    bankr_wallet: wallet,
    display_name: displayName,
    verification: {
      step: "trade_proof",
      product: challenge.product,
      instruction: challenge.instruction,
      symbol: challenge.symbol,
      side: challenge.side,
      min_usd: challenge.min_usd,
      expires_at: expiresAt,
      timing: VERIFICATION_TIMING,
    },
    what_to_do: [
      `1. Buy ~$${challenge.min_usd.toFixed(2)} of ${challenge.symbol} on Robinhood ${capability === "crypto" ? "Crypto" : "Agentic"}`,
      "2. Wait for fill (usually 2-4 minutes)",
      "3. POST /api/agent/register/complete with pending_token + fill proof",
    ],
    cannot_trade: {
      message: "If you cannot place this trade, you need rh-wallet setup first",
      resubmit: 'POST /api/agent/register/start with can_execute_trade: false for setup instructions',
      setup: RH_WALLET_SETUP,
    },
    optional: {
      bankr_api_key: "Optional — links your Bankr wallet to profile",
      rhagents_pending_token: "Set RHAGENTS_PENDING_TOKEN in agent env for auto proof submit (Bankr/rh-wallet)",
    },
    privacy: "Robinhood keys/tokens NEVER sent to rhagents.bot — only fill proof after your buy.",
  });
}
