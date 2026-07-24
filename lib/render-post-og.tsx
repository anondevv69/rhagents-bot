import { ImageResponse } from "next/og";
import type { FeedPost } from "@/lib/posts";
import { brandHeroDataUri } from "@/lib/brand-hero";
import { postOgAgentLabel, postOgDescription } from "@/lib/post-og";
import { SITE_NAME } from "@/lib/rhagent-setup";

export const POST_OG_SIZE = { width: 1200, height: 630 } as const;

const BG = "#111111";
const NEON = "#CCFF00";
const MUTED = "#A8AAB2";
const DIM = "#6E7178";

function tradeHeadlineParts(post: FeedPost): { side: string; symbol: string | null } | null {
  if (post.type !== "trade_fill" && post.type !== "trade_intent") return null;
  return {
    side: post.side ? post.side.toUpperCase() : "TRADE",
    symbol: post.symbol ?? null,
  };
}

function OgShell({
  agent,
  meta,
  body,
  trade,
}: {
  agent: string;
  meta: string;
  body: string;
  trade?: { side: string; symbol: string | null } | null;
}) {
  const hero = brandHeroDataUri();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BG,
        color: "#f5f5f5",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Robin Hood mark — same asset as hero.svg / landing */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 520,
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        {/* Hero mark — same asset as hero.svg / landing */}
        <img
          src={hero}
          alt=""
          width={520}
          height={630}
          style={{
            objectFit: "cover",
            objectPosition: "left bottom",
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      {/* Fade hero into content area */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(17,17,17,0.05) 0%, rgba(17,17,17,0.55) 38%, rgba(17,17,17,0.92) 52%, #111111 62%)",
        }}
      />

      {/* Watermark — matches site og-image.jpg */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 48,
          fontSize: 72,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: "rgba(58,74,16,0.55)",
          textTransform: "uppercase",
        }}
      >
        RHAGENT.BOT
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "52px 56px 48px 500px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: NEON, letterSpacing: "-0.02em" }}>
              {agent}
            </div>
            {trade ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-h2)",
                    fontWeight: 800,
                    color: BG,
                    background: NEON,
                    padding: "6px 14px",
                    borderRadius: 6,
                    textTransform: "uppercase",
                  }}
                >
                  {trade.side}
                </div>
                {trade.symbol ? (
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#fafafa" }}>{trade.symbol}</div>
                ) : null}
              </div>
            ) : null}
            <div style={{ fontSize: "var(--text-h3)", color: MUTED }}>{meta}</div>
          </div>

          {body ? (
            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                lineHeight: 1.28,
                letterSpacing: "-0.02em",
                color: "#f5f5f5",
                maxWidth: 640,
              }}
            >
              {body}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid #262626",
            paddingTop: 22,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: NEON }}>{SITE_NAME}</div>
          <div style={{ fontSize: 18, color: DIM }}>Agent trading feed</div>
        </div>
      </div>
    </div>
  );
}

/** Shared 1200×630 card for Discord / X / iMessage / Slack unfurls. */
export function renderPostOgImage(post: FeedPost | null): ImageResponse {
  if (!post) {
    return new ImageResponse(
      (
        <OgShell
          agent={SITE_NAME}
          meta="Post not found"
          body=""
        />
      ),
      { ...POST_OG_SIZE },
    );
  }

  const agent = postOgAgentLabel(post);
  const body = (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const meta = postOgDescription(post, 100);
  const trade = tradeHeadlineParts(post);

  return new ImageResponse(
    <OgShell agent={agent} meta={meta} body={body || meta} trade={trade} />,
    { ...POST_OG_SIZE },
  );
}
