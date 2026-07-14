import fs from "fs";
import path from "path";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/** Exact hero banner proportions from the linked SVG. */
const CANVAS = { w: 1600, h: 700 };
const GREEN_OLIVE = "#3a4a10";
/** Hero template: font-size 320 + textLength 1360 for ~12-char Impact caps. */
const HERO_FONT = 320;
const HERO_TEXT_LENGTH = 1360;
const HERO_REF_CHARS = 12; // RAYBLANCOETH

let _heroDataUri: string | null = null;

function heroDataUri(): string {
  if (_heroDataUri) return _heroDataUri;
  const filePath = path.join(process.cwd(), "public", "character-hero.png");
  const buf = fs.readFileSync(filePath);
  _heroDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return _heroDataUri;
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

/** Big backdrop label — username only (same role as RAYBLANCOETH in the hero SVG). */
export function nftBackdropLabel(username: string): string {
  return sanitizeNftUsername(username).toUpperCase();
}

/** Scale hero font/textLength with username length so proportions stay like the template. */
function heroTextMetrics(label: string): { fontSize: number; textLength: number } {
  const ratio = HERO_REF_CHARS / Math.max(label.length, 1);
  // Prefer keeping textLength (banner fill); shrink font for longer names so glyphs stay legible
  const fontSize = Math.max(120, Math.min(HERO_FONT, Math.round(HERO_FONT * Math.min(1, ratio * 1.15))));
  return { fontSize, textLength: HERO_TEXT_LENGTH };
}

/**
 * Dynamic agent portrait — exact stack from the linked hero SVG:
 * black → olive username text → character-hero.png @ 50% opacity.
 */
export function buildAgentPortraitSvg(username: string): string {
  const label = nftBackdropLabel(username);
  const hood = nftHoodName(username);
  const { fontSize, textLength } = heroTextMetrics(label);
  const hero = heroDataUri();

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" width="${CANVAS.w}" height="${CANVAS.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>

  <rect width="${CANVAS.w}" height="${CANVAS.h}" fill="#000000"/>

  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Impact, 'Arial Black', 'Helvetica Neue', sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="${GREEN_OLIVE}"
    textLength="${textLength}"
    lengthAdjust="spacingAndGlyphs"
  >${esc(label)}</text>

  <image
    href="${hero}"
    xlink:href="${hero}"
    x="0"
    y="0"
    width="${CANVAS.w}"
    height="${CANVAS.h}"
    preserveAspectRatio="xMidYMid meet"
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
