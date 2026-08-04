import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyChainWalletOwnership } from "@/lib/chain-proof";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey } from "@/lib/agent-identity";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";
import { setViewerCookie } from "@/lib/viewer";
import { normalizeChainWallet } from "@/lib/rhagent-holdings";

export const dynamic = "force-dynamic";

/**
 * POST /api/viewer/wallet/connect
 *
 * Prove wallet ownership (personal_sign) and attach chain_wallet to the current
 * viewer session — preserves X / Telegram / Discord from agent-code or OAuth login.
 *
 * Body: { chain_wallet, nonce, signature }
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`wallet-connect:${clientIp(req)}`, 20, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in first (email, X, agent code, or wallet)." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const chain_wallet = typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : "";
  const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!chain_wallet || !nonce || !signature) {
    return NextResponse.json(
      { ok: false, error: "chain_wallet, nonce, and signature required" },
      { status: 400 },
    );
  }

  const ownership = await verifyChainWalletOwnership({ chain_wallet, nonce, signature });
  if (!ownership.ok) {
    return NextResponse.json({ ok: false, error: ownership.error }, { status: 400 });
  }

  const wallet = normalizeChainWallet(ownership.wallet);
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "invalid_wallet" }, { status: 400 });
  }

  const owned = listAgentsOwnedBySession(session!);
  const agentsNeedingWallet = owned.filter((a) => !a.chain_wallet);

  const payload = {
    ok: true,
    chain_wallet: wallet,
    session_identity: viewerIdentityKey(session!),
    owned_agents: owned.length,
    agents_without_wallet: agentsNeedingWallet.map((a) => ({
      id: a.id,
      username: a.username,
    })),
    message:
      agentsNeedingWallet.length > 0
        ? "Wallet connected to your account. Link it to your agent in settings when you're ready to post on-chain."
        : "Wallet connected to your account.",
  };

  return setViewerCookie(NextResponse.json(payload), { chain_wallet: wallet }, { merge: session });
}
