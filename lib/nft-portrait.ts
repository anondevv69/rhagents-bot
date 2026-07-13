import fs from "fs";
import path from "path";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

const CANVAS = { w: 1024, h: 683 };
const GREEN_DIM = "#1a3d00";
const GREEN_MID = "#2f5e00";
const GREEN_BRIGHT = "#ccff00";

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

/** Big background label — same role as RHAGENT.BOT in the promo art. */
export function nftBackdropLabel(username: string): string {
  return sanitizeNftUsername(username).toUpperCase();
}

export function nftHoodName(username: string): string {
  return `rhagent.${sanitizeNftUsername(username).toLowerCase()}.hood`;
}

function fontSizeForLabel(label: string): number {
  const len = label.length;
  if (len <= 8) return 148;
  if (len <= 12) return 112;
  if (len <= 16) return 88;
  if (len <= 22) return 68;
  return 52;
}

/**
 * Dynamic agent portrait SVG.
 * Layout matches the promo: black field, large username text behind the figure,
 * Rhagent Robin Hood mark in front (from public/rhagent-mark.png).
 */
export function buildAgentPortraitSvg(username: string): string {
  const label = nftBackdropLabel(username);
  const hood = nftHoodName(username);
  const fontSize = fontSizeForLabel(label);
  const mark = markDataUri();

  // Escape for XML text nodes
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS.w}" height="${CANVAS.h}" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>
  <defs>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="${GREEN_DIM}"/>
      <rect y="2" width="4" height="2" fill="${GREEN_MID}"/>
    </pattern>
    <linearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="55%" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.75"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.2" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Canvas -->
  <rect width="100%" height="100%" fill="#000000"/>

  <!-- Backdrop username (promo RHAGENT.BOT slot) -->
  <g transform="translate(36, 210)">
    <text
      x="0"
      y="0"
      fill="url(#scan)"
      font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      font-weight="900"
      font-size="${fontSize}"
      letter-spacing="-0.04em"
      filter="url(#glow)"
    >${esc(label)}</text>
    <!-- Darker outline pass for depth behind the figure -->
    <text
      x="0"
      y="0"
      fill="none"
      stroke="${GREEN_DIM}"
      stroke-width="1.5"
      stroke-opacity="0.55"
      font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      font-weight="900"
      font-size="${fontSize}"
      letter-spacing="-0.04em"
    >${esc(label)}</text>
  </g>

  <!-- Soft vignette so mark reads cleanly over long names -->
  <rect width="100%" height="100%" fill="url(#fadeR)" opacity="0.45"/>

  <!-- Character mark (same SVG/PNG brand as the site) -->
  <image
    href="${mark}"
    xlink:href="${mark}"
    x="0"
    y="0"
    width="${CANVAS.w}"
    height="${CANVAS.h}"
    preserveAspectRatio="xMidYMid meet"
  />

  <!-- Small hood caption -->
  <text
    x="28"
    y="658"
    fill="${GREEN_BRIGHT}"
    fill-opacity="0.55"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    font-size="16"
    letter-spacing="0.04em"
  >${esc(hood)}</text>
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
