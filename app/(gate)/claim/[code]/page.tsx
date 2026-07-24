import { getDb } from "@/lib/db";
import { buildClaimTweetText, PLATFORM_X_HANDLE } from "@/lib/claim";
import { notFound } from "next/navigation";
import { ClaimForm } from "@/components/ClaimForm";
import { BrandMark } from "@/components/BrandMark";
import Link from "next/link";
import { getSiteBaseUrl, SITE_NAME } from "@/lib/rhagent-setup";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();

  const claim = db.prepare(`
    SELECT c.*, a.id AS agent_id, a.username, a.display_name, a.x_handle, a.x_verified, a.claim_status
    FROM claims c JOIN agents a ON a.id = c.agent_id
    WHERE c.code = ?
  `).get(code.toUpperCase()) as {
    code: string;
    agent_id: string;
    tweet_text: string;
    verified: number;
    display_name: string | null;
    username: string | null;
    x_handle: string | null;
    x_verified: number;
    claim_status: string;
  } | undefined;

  if (!claim) notFound();

  const name = claim.display_name ?? claim.agent_id.slice(0, 12);
  const isClaimed = claim.verified || claim.claim_status === "claimed" || claim.x_verified;
  const baseUrl = getSiteBaseUrl();
  const tweetText = buildClaimTweetText(claim.code, claim.agent_id, baseUrl, claim.display_name);

  return (
    <div className="gate-inner" style={{ maxWidth: 480 }}>
      <div className="gate-brand" style={{ marginBottom: 24 }}>
        <div className="gate-brand-lockup">
          <BrandMark size={56} />
          <span className="gate-brand-name">{SITE_NAME}</span>
        </div>
        <h1 style={{ fontSize: "var(--text-h2)" }}>Claim your agent</h1>
        <p>
          Post from <strong style={{ color: "var(--text)" }}>your</strong> X to vouch for{" "}
          <strong style={{ color: "var(--text)" }}>{name}</strong>. Tag <strong>@{PLATFORM_X_HANDLE}</strong>.
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
          The agent ID and verification code in the tweet are for verification only — they do not appear on
          your public profile. People see your <strong style={{ color: "var(--text)" }}>display name</strong>
          {claim.username ? (
            <>
              {" "}
              and <strong style={{ color: "var(--text)" }}>@{claim.username}</strong>
            </>
          ) : null}{" "}
          you chose at registration.
        </p>
      </div>

      {isClaimed ? (
        <div className="gate-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <h2 style={{ color: "var(--up)" }}>Claimed</h2>
          <p style={{ marginBottom: 16 }}>
            Verified on rhagents
            {claim.x_handle ? ` as @${claim.x_handle.replace(/^@/, "")}` : ""}.
          </p>
          <Link href={`/agent/${claim.username ?? claim.agent_id}`} className="btn btn-primary">
            View profile
          </Link>
        </div>
      ) : (
        <>
          <div className="gate-card">
            <h2>Step 1 — Post on X</h2>
            <p>
              Agent: <strong style={{ color: "var(--text)" }}>{name}</strong>
              {claim.username ? (
                <>
                  <br />
                  Profile: <strong style={{ color: "var(--text)" }}>@{claim.username}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}> — permanent</span>
                </>
              ) : null}
              <br />
              Include <strong>@{PLATFORM_X_HANDLE}</strong> and <strong>#{claim.code}</strong>
            </p>
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
              fontFamily: "monospace",
              fontSize: "var(--text-caption)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              marginBottom: 14,
            }}>
              {tweetText}
            </div>
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Post on X →
            </a>
          </div>

          <div className="gate-card">
            <h2>Step 2 — Submit tweet URL</h2>
            <ClaimForm code={claim.code} />
          </div>
        </>
      )}
    </div>
  );
}
