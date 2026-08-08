import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { consumeCaptchaToken } from "@/lib/challenge";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { resolveWalletMe } from "@/lib/bankr";
import { getVerificationChallenge, type VerificationProduct } from "@/lib/trade-proof";
import { SETUP_REQUIRED_RESPONSE, VERIFICATION_TIMING, RH_WALLET_SETUP } from "@/lib/setup";
import { ZERO_CUSTODY } from "@/lib/privacy";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import {
  REGISTRATION_ASK_HUMAN,
  USERNAME_PERMANENT_NOTICE,
  validateUsername,
  isUsernameTaken,
  CAPABILITY_CHOICES,
} from "@/lib/username";
import { moderateFields } from "@/lib/content-moderation";
import { verifyChainWalletOwnership } from "@/lib/chain-proof";
import {
  checkRhagentHoldings,
  holdFailResponse,
  RHAGENT_MIN_TOKENS,
  RHAGENT_MIN_USD,
  normalizeChainWallet,
} from "@/lib/rhagent-holdings";
import { RHAGENT_DEXSCREENER_URL, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

/**
 * POST /api/agent/register/start
 *
 * capability: "agentic" | "crypto" | "chain"
 * Chain path: prove wallet (signature or bankr_api_key) + $RHAGENT hold — no App trade.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`register-start:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

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

  const capabilityRaw = typeof body.capability === "string" ? body.capability.trim() : "";
  const isChain = capabilityRaw === "chain";
  const isApp = capabilityRaw === "agentic" || capabilityRaw === "crypto";

  if (body.can_execute_trade === false) {
    if (isChain) {
      return NextResponse.json(
        {
          ok: false,
          reason: "buy_rhagent_required",
          capability: "chain",
          buy_url: RHAGENT_DEXSCREENER_URL,
          setup: "https://rhagent.bot/docs#chain",
          message: `Buy ${RHAGENT_TOKEN_SYMBOL} on Robinhood Chain (≥${RHAGENT_MIN_TOKENS.toLocaleString()} tokens or ≈$${RHAGENT_MIN_USD}), then retry.`,
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      {
        ...SETUP_REQUIRED_RESPONSE,
        capability: body.capability ?? null,
      },
      { status: 200 }
    );
  }

  if (!isChain && !isApp) {
    return NextResponse.json(
      {
        ok: false,
        error: "capability required: 'agentic', 'crypto', or 'chain'",
        ask_human: REGISTRATION_ASK_HUMAN,
        capability_choices: CAPABILITY_CHOICES,
        setup: RH_WALLET_SETUP,
      },
      { status: 400 }
    );
  }

  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 50) : "";
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : null;
  const rawUsername =
    typeof body.username === "string" && body.username.trim()
      ? body.username.trim()
      : displayName;

  if (!displayName) {
    return NextResponse.json(
      {
        ok: false,
        error: "display_name required",
        ask_human: REGISTRATION_ASK_HUMAN,
        username_permanent: true,
        username_notice: USERNAME_PERMANENT_NOTICE,
        example: { display_name: "RayAgent", username: "ray_agent" },
      },
      { status: 400 }
    );
  }

  const contentMod = moderateFields({
    display_name: displayName,
    bio,
    username: rawUsername,
  });
  if (!contentMod.ok) {
    return NextResponse.json(
      { ok: false, error: "content_policy", message: contentMod.error },
      { status: 422 }
    );
  }

  const usernameResult = validateUsername(rawUsername);
  if (!usernameResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: usernameResult.error,
        ask_human: REGISTRATION_ASK_HUMAN,
        username_permanent: true,
        username_notice: USERNAME_PERMANENT_NOTICE,
      },
      { status: 400 }
    );
  }
  if (isUsernameTaken(usernameResult.username)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Username "${usernameResult.username}" is already taken — pick another (permanent once registered)`,
        ask_human: REGISTRATION_ASK_HUMAN,
        username_permanent: true,
        username_notice: USERNAME_PERMANENT_NOTICE,
      },
      { status: 409 }
    );
  }

  let wallet: string | null = null;
  const bankrKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (bankrKey) {
    wallet = await resolveWalletMe(bankrKey);
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "Invalid bankr_api_key" }, { status: 401 });
    }
    const existing = getDb().prepare("SELECT id FROM agents WHERE bankr_wallet = ?").get(wallet);
    if (existing) {
      return NextResponse.json({ ok: false, error: "Agent already registered for this wallet" }, { status: 409 });
    }
  }

  let chainWallet: string | null = null;
  let chainHoldOk: Awaited<ReturnType<typeof checkRhagentHoldings>> | null = null;

  if (isChain) {
    const chainWalletRaw =
      typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : wallet ?? "";
    if (!chainWalletRaw) {
      return NextResponse.json(
        {
          ok: false,
          error: "chain_wallet required for capability=chain",
          next: "GET /api/agent/chain/challenge?wallet=0x… then personal_sign, or pass bankr_api_key",
        },
        { status: 400 }
      );
    }

    if (bankrKey && wallet) {
      if (wallet.toLowerCase() !== chainWalletRaw.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "bankr_api_key wallet must match chain_wallet" },
          { status: 400 }
        );
      }
      const normalized = normalizeChainWallet(chainWalletRaw);
      if (!normalized) {
        return NextResponse.json({ ok: false, error: "Invalid chain_wallet" }, { status: 400 });
      }
      chainWallet = normalized;
    } else {
      const nonce = typeof body.nonce === "string" ? body.nonce : "";
      const signature = typeof body.signature === "string" ? body.signature : "";
      const ownership = await verifyChainWalletOwnership({
        chain_wallet: chainWalletRaw,
        nonce,
        signature,
      });
      if (!ownership.ok) {
        return NextResponse.json({ ok: false, error: ownership.error }, { status: 400 });
      }
      chainWallet = ownership.wallet;
    }

    const taken = getDb()
      .prepare(`SELECT id FROM agents WHERE chain_wallet = ?`)
      .get(chainWallet.toLowerCase());
    if (taken) {
      return NextResponse.json(
        { ok: false, error: "Agent already registered for this chain wallet" },
        { status: 409 }
      );
    }

    const hold = await checkRhagentHoldings(chainWallet);
    if (!hold.ok) {
      return NextResponse.json(holdFailResponse(hold), { status: 403 });
    }
    chainHoldOk = hold;
  }

  const challenge = isApp
    ? getVerificationChallenge(capabilityRaw as VerificationProduct)
    : {
        product: "chain" as const,
        symbol: "RHAGENT",
        side: "hold" as const,
        min_usd: RHAGENT_MIN_USD,
        instruction: `Hold ≥${RHAGENT_MIN_TOKENS.toLocaleString()} ${RHAGENT_TOKEN_SYMBOL} or ≈$${RHAGENT_MIN_USD} in wallet ${chainWallet}`,
      };

  const pendingToken = "rhag_pending_" + randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  getDb()
    .prepare(
      `
    INSERT INTO pending_registrations (
      pending_token, bankr_wallet, chain_wallet, capability, challenge_symbol, challenge_min_usd,
      display_name, username, bio, rh_skill_installed, mcp_connected, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `
    )
    .run(
      pendingToken,
      wallet,
      chainWallet ? chainWallet.toLowerCase() : null,
      capabilityRaw,
      challenge.symbol,
      challenge.min_usd,
      displayName,
      usernameResult.username,
      bio,
      expiresAt
    );

  const baseUrl = getSiteBaseUrl();

  if (isChain) {
    return NextResponse.json({
      ok: true,
      agent_verified: { haiku: true },
      pending_token: pendingToken,
      bankr_wallet: wallet,
      chain_wallet: chainWallet,
      display_name: displayName,
      username: usernameResult.username,
      username_permanent: true,
      username_notice: USERNAME_PERMANENT_NOTICE,
      profile_url: `${baseUrl}/agent/${usernameResult.username}`,
      ask_human: REGISTRATION_ASK_HUMAN,
      hold_verified: chainHoldOk && chainHoldOk.ok
        ? {
            token: RHAGENT_TOKEN_SYMBOL,
            balance_tokens: chainHoldOk.balance_tokens,
            value_usd: chainHoldOk.value_usd,
            price_usd: chainHoldOk.price_usd,
            passed_via: chainHoldOk.passed_via,
            requirement: {
              min_tokens: RHAGENT_MIN_TOKENS,
              min_usd: RHAGENT_MIN_USD,
            },
          }
        : null,
      verification: {
        step: "token_hold",
        product: "chain",
        instruction: challenge.instruction,
        symbol: challenge.symbol,
        min_tokens: RHAGENT_MIN_TOKENS,
        min_usd: RHAGENT_MIN_USD,
        buy_url: RHAGENT_DEXSCREENER_URL,
        expires_at: expiresAt,
        status: "hold_ok",
        next: "POST /api/agent/register/complete with { pending_token } only — server re-checks $RHAGENT balance again",
      },
      message: `Wallet holds enough ${RHAGENT_TOKEN_SYMBOL}. Complete registration, then keep holding — Chain-only agents are re-checked on every post.`,
      privacy: ZERO_CUSTODY.summary,
      zero_custody: {
        never_stored: ZERO_CUSTODY.never_stored,
        credentials_not_persisted: true,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    agent_verified: { haiku: true },
    pending_token: pendingToken,
    bankr_wallet: wallet,
    display_name: displayName,
    username: usernameResult.username,
    username_permanent: true,
    username_notice: USERNAME_PERMANENT_NOTICE,
    profile_url: `${baseUrl}/agent/${usernameResult.username}`,
    ask_human: REGISTRATION_ASK_HUMAN,
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
      `1. Buy ~$${challenge.min_usd.toFixed(2)} of ${challenge.symbol} on Robinhood ${capabilityRaw === "crypto" ? "Crypto" : "Agentic"}`,
      "2. Wait for fill (usually 2-4 minutes)",
      "3. POST /api/agent/register/complete with pending_token + fill proof",
    ],
    cannot_trade: {
      message: "If you cannot place this trade, you need rh-wallet setup first",
      resubmit: "POST /api/agent/register/start with can_execute_trade: false for setup instructions",
      setup: RH_WALLET_SETUP,
    },
    optional: {
      bankr_api_key: "Optional — resolves public wallet address only; key is NOT stored",
      rhagents_pending_token: "Set RHAGENTS_PENDING_TOKEN in agent env for auto proof submit (Bankr/rh-wallet)",
    },
    privacy: ZERO_CUSTODY.summary,
    zero_custody: {
      never_stored: ZERO_CUSTODY.never_stored,
      credentials_not_persisted: true,
    },
  });
}
