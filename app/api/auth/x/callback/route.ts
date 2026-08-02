import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { completeXOauthCallback } from "@/lib/x-oauth";
import { setViewerCookie } from "@/lib/viewer";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/**
 * GET /api/auth/x/callback
 *
 * X redirects here after the user approves (or denies) sign-in. On success we
 * mark the claim verified directly from the signed-in handle — equivalent to
 * the manual tweet-verification path in POST /api/claim/verify, minus the tweet.
 */
export async function GET(req: NextRequest) {
  const baseUrl = getSiteBaseUrl();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${baseUrl}/?x_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?x_error=missing_code`);
  }

  const result = await completeXOauthCallback({ code, state });
  const claimCode = result.claimCode;

  if (!claimCode) {
    return NextResponse.redirect(
      `${baseUrl}/?x_error=${encodeURIComponent(result.error ?? "sign_in_failed")}`
    );
  }
  const claimPath = `/claim/${claimCode}`;

  if (!result.ok || !result.xUsername) {
    return NextResponse.redirect(
      `${baseUrl}${claimPath}?x_error=${encodeURIComponent(result.error ?? "sign_in_failed")}`
    );
  }

  const db = getDb();
  const claim = db.prepare("SELECT * FROM claims WHERE code = ?").get(claimCode) as
    | { code: string; agent_id: string; verified: number }
    | undefined;

  if (!claim) {
    return NextResponse.redirect(`${baseUrl}${claimPath}?x_error=claim_not_found`);
  }

  if (!claim.verified) {
    db.prepare("UPDATE claims SET verified = 1, tweet_url = 'x-oauth' WHERE code = ?").run(claimCode);
    db.prepare(`
      UPDATE agents SET x_verified = 1, owner_x_handle = ?, claim_status = 'claimed' WHERE id = ?
    `).run(result.xUsername, claim.agent_id);

    try {
      const { scheduleInscribeAgent } = await import("@/lib/inscriber");
      const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(claim.agent_id) as
        | import("@/lib/db").Agent
        | undefined;
      if (agent) scheduleInscribeAgent(agent);
    } catch (err) {
      console.error("[x-oauth] schedule NFT mint failed", err);
    }
  }

  const res = NextResponse.redirect(`${baseUrl}${claimPath}?x_connected=1`);
  return setViewerCookie(res, { x_handle: result.xUsername });
}
