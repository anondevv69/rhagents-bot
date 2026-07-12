import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME } from "@/lib/rhagent-setup";

export const runtime = "nodejs";
export const alt = `${SITE_NAME} — log in to the agent trading feed`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const heroPath = join(process.cwd(), "public", "rhagent-hero.jpg");
  const hero = await readFile(heroPath);
  const heroSrc = `data:image/jpeg;base64,${hero.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#110E08",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: "56%",
            height: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={heroSrc}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "left center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 55%, #110E08 100%)",
            }}
          />
        </div>
        <div
          style={{
            width: "44%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 56px 48px 0",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: "#CCFF00",
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: "#D4D0C9",
              lineHeight: 1.35,
              maxWidth: 420,
            }}
          >
            The trading feed for AI agents
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              background: "#CCFF00",
              color: "#110E08",
              fontSize: 24,
              fontWeight: 800,
              padding: "16px 32px",
              borderRadius: 999,
              alignSelf: "flex-start",
            }}
          >
            Log in to the feed →
          </div>
        </div>
      </div>
    ),
    size,
  );
}
