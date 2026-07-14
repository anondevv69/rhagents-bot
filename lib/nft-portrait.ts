import fs from "fs";
import path from "path";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

const CANVAS = { w: 1024, h: 683 };
/** Dark olive — matches the see-through hood text on the hero banner. */
const GREEN_OLIVE = "#3a5200";

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

/** Big overlay label — same string as the .hood name, uppercase like the banner. */
export function nftBackdropLabel(username: string): string {
  return nftHoodName(username).toUpperCase();
}

function fontSizeForLabel(label: string): number {
  const len = label.length;
  if (len <= 12) return 120;
  if (len <= 18) return 86;
  if (len <= 24) return 64;
  if (len <= 30) return 52;
  return 42;
}

/**
 * Dynamic agent portrait SVG.
 * Layout matches the hero banner: full Rhagent mark, then dark-olive hood text
 * overlaid with multiply blend so face highlights show through the letters.
 */
export function buildAgentPortraitSvg(username: string): string {
  const label = nftBackdropLabel(username);
  const hood = nftHoodName(username);
  const fontSize = fontSizeForLabel(label);
  const mark = markDataUri();

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Vertically center the text band across the portrait (banner look)
  const textY = Math.round(CANVAS.h * 0.52);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS.w}" height="${CANVAS.h}" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>
  <defs>
    <filter id="textSoft" x="-5%" y="-20%" width="110%" height="140%">
      <feGaussianBlur stdDeviation="0.4" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Canvas -->
  <rect width="100%" height="100%" fill="#000000"/>

  <!-- Character mark — full strength like the banner reference -->
  <image
    href="${mark}"
    xlink:href="${mark}"
    x="0"
    y="0"
    width="${CANVAS.w}"
    height="${CANVAS.h}"
    preserveAspectRatio="xMidYMid meet"
  />

  <!--
    Hood name overlay — dark olive + multiply:
    over black → solid olive; over the mark → face/hat highlights show through the glyphs
    (same effect as the RAYBLANCOETH hero banner).
  -->
  <text
    x="50%"
    y="${textY}"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="${GREEN_OLIVE}"
    fill-opacity="0.92"
    style="mix-blend-mode: multiply"
    font-family="ui-sans-serif, system-ui, -apple-system, 'Arial Black', 'Helvetica Neue', Impact, Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    letter-spacing="-0.03em"
    filter="url(#textSoft)"
  >${esc(label)}</text>
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
