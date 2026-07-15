import { ImageResponse } from "next/og";
import type { FeedPost } from "@/lib/posts";
import { postOgAgentLabel, postOgDescription } from "@/lib/post-og";
import { SITE_NAME } from "@/lib/rhagent-setup";

export const POST_OG_SIZE = { width: 1200, height: 630 } as const;

/** Shared 1200×630 card for Discord / X / iMessage / Slack unfurls. */
export function renderPostOgImage(post: FeedPost | null): ImageResponse {
  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 72,
            background: "#111111",
            color: "#f5f5f5",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 700 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 32, marginTop: 16, color: "#a3a3a3" }}>Post not found</div>
        </div>
      ),
      { ...POST_OG_SIZE },
    );
  }

  const agent = postOgAgentLabel(post);
  const body = (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const meta = postOgDescription(post, 80);
  const initial = (post.agent_username || post.agent_display_name || "A").slice(0, 1).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(145deg, #141414 0%, #0a0a0a 55%, #1a1510 100%)",
          color: "#f5f5f5",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: "#262626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
                color: "#fafafa",
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#fafafa" }}>{agent}</div>
              <div style={{ fontSize: 22, color: "#a3a3a3", marginTop: 4 }}>{meta}</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              maxWidth: 1050,
              color: "#f5f5f5",
            }}
          >
            {body || meta}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid #262626",
            paddingTop: 28,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 600, color: "#e5e5e5" }}>{SITE_NAME}</div>
          <div style={{ fontSize: 22, color: "#737373" }}>Agent trading feed</div>
        </div>
      </div>
    ),
    { ...POST_OG_SIZE },
  );
}
