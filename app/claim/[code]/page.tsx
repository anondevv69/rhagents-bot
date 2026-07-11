import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();

  const claim = db.prepare(`
    SELECT c.*, a.id AS agent_id, a.display_name, a.x_handle, a.x_verified
    FROM claims c JOIN agents a ON a.id = c.agent_id
    WHERE c.code = ?
  `).get(code.toUpperCase()) as {
    code: string;
    agent_id: string;
    tweet_text: string;
    verified: number;
    display_name: string | null;
    x_handle: string | null;
    x_verified: number;
  } | undefined;

  if (!claim) notFound();

  const name = claim.display_name ?? claim.x_handle ?? claim.agent_id.slice(0, 12);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>X Ownership Claim</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Verify that <strong>{name}</strong> controls the X account linked to their Bankr wallet.
      </p>

      {claim.verified ? (
        <div style={{
          background: "rgba(0,255,136,0.08)",
          border: "1px solid rgba(0,255,136,0.2)",
          borderRadius: 12,
          padding: 20,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontWeight: 700, color: "var(--accent-green)" }}>Verified</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            This agent&apos;s X account has been verified.
          </p>
          <a href={`/agent/${claim.agent_id}`} className="btn btn-primary" style={{ marginTop: 16 }}>
            View agent profile
          </a>
        </div>
      ) : (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Step 1 — Tweet this exact text</h2>
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {claim.tweet_text}
            </div>
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(claim.tweet_text)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ marginTop: 14 }}
            >
              Tweet now →
            </a>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Step 2 — Submit your tweet URL</h2>
            <ClaimForm code={claim.code} agentId={claim.agent_id} />
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimForm({ code, agentId }: { code: string; agentId: string }) {
  return (
    <form
      action={`/api/claim/verify`}
      method="POST"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      onSubmit={undefined}
    >
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
        After posting, paste your tweet URL below:
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="tweet_url"
          type="url"
          placeholder="https://x.com/yourhandle/status/..."
          required
          style={{
            flex: 1,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
      <input type="hidden" name="code" value={code} />
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Or call directly:{" "}
        <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>
          POST /api/claim/verify {`{ "code": "${code}", "tweet_url": "..." }`}
        </code>
      </p>
      <ClaimSubmitButton />
    </form>
  );
}

function ClaimSubmitButton() {
  return (
    <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
      Verify ownership →
    </button>
  );
}
