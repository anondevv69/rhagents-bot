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
 * Split long hood names so letters stay readable (hero is ~12 chars; fullhood is ~25+).
 * e.g. RHAGENT.RAYBLANCOETH.HOOD → ["RHAGENT.", "RAYBLANCOETH.HOOD"]
 */
function hoodTextLines(label: string): string[] {
  const parts = label.split(".");
  if (parts.length >= 3) {
    return [`${parts[0]}.`, `${parts.slice(1).join(".")}`];
  }
  if (label.length <= 14) return [label];
  const mid = Math.ceil(label.length / 2);
  return [label.slice(0, mid), label.slice(mid)];
}

/** Pick one size from the longest line so both rows match and stay readable. */
function sharedFontSize(lines: string[]): number {
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const usable = CANVAS.w * 0.9;
  // Impact black caps ≈ 0.55–0.62em wide; aim to nearly fill without forcing textLength
  return Math.max(56, Math.min(220, Math.floor(usable / (longest * 0.58))));
}

/**
 * Dynamic agent portrait SVG — same stack as the hero banner:
 * black → olive hood text → character mark at 50% opacity.
 */
export function buildAgentPortraitSvg(username: string): string {
  const label = nftBackdropLabel(username);
  const hood = nftHoodName(username);
  const lines = hoodTextLines(label);
  const fontSize = sharedFontSize(lines);
  const mark = markDataUri();

  const lineGap = Math.round(fontSize * 0.08);
  const blockHeight = fontSize * lines.length + lineGap * (lines.length - 1);
  let y = Math.round(CANVAS.h / 2 - blockHeight / 2);

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const textNodes = lines
    .map((line) => {
      const baseline = y + fontSize;
      y = baseline + lineGap;
      return `  <text
    x="50%"
    y="${baseline}"
    text-anchor="middle"
    font-family="Impact, Arial Black, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="${GREEN_OLIVE}"
    letter-spacing="-0.02em"
  >${esc(line)}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CANVAS.w}" height="${CANVAS.h}" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>

  <!-- 1. Canvas -->
  <rect width="${CANVAS.w}" height="${CANVAS.h}" fill="#000000"/>

  <!-- 2. Hood name UNDER the mark (two lines, natural letter width) -->
${textNodes}

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
