import fs from "fs";
import path from "path";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/** Match rhagent-mark.png so the figure fills the frame. */
const CANVAS = { w: 1024, h: 682 };
/** Dark olive — matches the see-through hood text on the hero banner. */
const GREEN_OLIVE = "#3a4a10";

let _markDataUri: string | null = null;

function markDataUri(): string {
  if (_markDataUri) return _markDataUri;
  const filePath = path.join(process.cwd(), "public", "rhagent-mark.png");
  const buf = fs.readFileSync(filePath);
  _markDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return _markDataUri;
}

/** Sanitize username for display + URL slug. */
export function sanitizeNftUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 30) || "agent";
}

export function nftHoodName(username: string): string {
  return `rhagent.${sanitizeNftUsername(username).toLowerCase()}.hood`;
}

/** Big label behind the mark — uppercase hood name. */
export function nftBackdropLabel(username: string): string {
  return nftHoodName(username).toUpperCase();
}

/**
 * Banner-style fit: keep glyphs TALL (font-size), stretch to nearly full width
 * via textLength — same as the hero (font-size 320 + textLength 1360 on 1600×700).
 */
function fitText(_label: string): { fontSize: number; textLength: number } {
  const textLength = Math.round(CANVAS.w * 0.92);
  // ~40% of canvas height — matches hero's 320/700
  const fontSize = Math.round(CANVAS.h * 0.4);
  return { fontSize, textLength };
}

/**
 * Dynamic agent portrait SVG — same stack as the hero banner:
 * black → olive hood text → character mark at 50% opacity.
 */
export function buildAgentPortraitSvg(username: string): string {
  const label = nftBackdropLabel(username);
  const hood = nftHoodName(username);
  const { fontSize, textLength } = fitText(label);
  const mark = markDataUri();

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS.w}" height="${CANVAS.h}" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>

  <!-- 1. Canvas -->
  <rect width="${CANVAS.w}" height="${CANVAS.h}" fill="#000000"/>

  <!-- 2. Hood name UNDER the mark — sized to fit full width -->
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Impact, Arial Black, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="${GREEN_OLIVE}"
    textLength="${textLength}"
    lengthAdjust="spacingAndGlyphs"
  >${esc(label)}</text>

  <!-- 3. Character ON TOP at 50% — text shows through the figure -->
  <image
    href="${mark}"
    xlink:href="${mark}"
    x="0"
    y="0"
    width="${CANVAS.w}"
    height="${CANVAS.h}"
    preserveAspectRatio="xMidYMid slice"
    opacity="0.5"
  />
</svg>`;
}

export function agentPortraitImageUrl(username: string): string {
  const slug = encodeURIComponent(sanitizeNftUsername(username).toLowerCase());
  return `${getSiteBaseUrl()}/api/nft/image/${slug}`;
}

export function agentPortraitMetadataUrl(username: string): string {
  const slug = encodeURIComponent(sanitizeNftUsername(username).toLowerCase());
  return `${getSiteBaseUrl()}/api/nft/metadata/${slug}`;
}

export function buildAgentPortraitMetadata(username: string) {
  const name = sanitizeNftUsername(username);
  const hood = nftHoodName(name);
  return {
    name: hood,
    description: `Rhagent identity NFT for ${name}. Soulbound agent badge on Robinhood Chain.`,
    image: agentPortraitImageUrl(name),
    external_url: `${getSiteBaseUrl()}/agent/${encodeURIComponent(name.toLowerCase())}`,
    attributes: [
      { trait_type: "username", value: name },
      { trait_type: "hood", value: hood },
      { trait_type: "collection", value: "Rhagent Agent NFT" },
    ],
  };
}
