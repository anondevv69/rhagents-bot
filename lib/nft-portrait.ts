import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import {
  buildGuillocheBackdropMarkup,
  guillocheDisplayName,
  sanitizeAgentKey,
} from "@/lib/guilloche";

/** Marketplace-standard square NFT. */
const SQUARE = { w: 1024, h: 1024 };
/** Wide banner (site/hero). */
const BANNER = { w: 1600, h: 700 };
/** Olive for centered account name — bright enough to read over guilloché. */
const GREEN_OLIVE = "#9bc03a";
/** Soft charcoal under guilloché. */
const BG = "#1f2123";
export type PortraitLayout = "square" | "banner";

/**
 * Locked NFT look (preview :8780):
 * Square → full-frame slice (character fills height, clipped sides).
 * Banner → meet.
 */
function heroPlacement(canvas: { w: number; h: number }, layout: PortraitLayout) {
  return {
    x: 0,
    y: 0,
    width: canvas.w,
    height: canvas.h,
    preserveAspectRatio: (layout === "square" ? "xMidYMid slice" : "xMidYMid meet") as
      | "xMidYMid slice"
      | "xMidYMid meet",
  };
}

let _heroDataUri: string | null = null;
let _fontCss: string | null = null;

function heroDataUri(): string {
  if (_heroDataUri) return _heroDataUri;
  const filePath = path.join(process.cwd(), "public", "character-hero.png");
  const buf = fs.readFileSync(filePath);
  _heroDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return _heroDataUri;
}

/** Embed Anton (OFL) so Railway/Linux renders names (no Impact/Arial Black there). */
function displayFontCss(): string {
  if (_fontCss) return _fontCss;
  const filePath = path.join(process.cwd(), "public", "fonts", "Anton-Regular.ttf");
  const b64 = fs.readFileSync(filePath).toString("base64");
  _fontCss = `@font-face{font-family:'RhagentDisplay';src:url('data:font/ttf;base64,${b64}') format('truetype');font-weight:400;font-style:normal;}`;
  return _fontCss;
}

/** Sanitize username for display + URL slug. */
export function sanitizeNftUsername(raw: string): string {
  return (
    raw
      .trim()
      .replace(/^@/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "")
      .slice(0, 30) || "agent"
  );
}

export function nftHoodName(username: string): string {
  return `rhagent.${sanitizeNftUsername(username).toLowerCase()}.hood`;
}

/** Centered overlay — RHAGENT.<USER>. */
export function nftOverlayLabel(username: string): string {
  return guillocheDisplayName(sanitizeAgentKey(username));
}

/** @deprecated use nftOverlayLabel */
export function nftBackdropLabel(username: string): string {
  return sanitizeNftUsername(username).toUpperCase();
}

function overlayTextMetrics(
  label: string,
  canvasW: number,
): { fontSize: number; textLength: number } {
  const usable = canvasW * 0.88;
  const fontSize = Math.max(
    48,
    Math.min(Math.round(canvasW * 0.11), Math.round((usable / Math.max(label.length, 1)) * 1.4)),
  );
  return { fontSize, textLength: Math.round(usable) };
}

/**
 * NFT portrait SVG — charcoal + guilloché → character → centered RHAGENT.<USER>.
 * Default layout is square (marketplace NFT).
 */
export function buildAgentPortraitSvg(
  username: string,
  layout: PortraitLayout = "square",
): string {
  const agentKey = sanitizeNftUsername(username);
  const label = nftOverlayLabel(agentKey);
  const hood = nftHoodName(agentKey);
  const canvas = layout === "banner" ? BANNER : SQUARE;
  const { fontSize, textLength } = overlayTextMetrics(label, canvas.w);
  const hero = heroDataUri();
  const guilloche = buildGuillocheBackdropMarkup({
    agentKey,
    width: canvas.w,
    height: canvas.h,
    style: "security",
    density: layout === "square" ? "compact" : "full",
  });

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const place = heroPlacement(canvas, layout);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${canvas.w} ${canvas.h}" width="${canvas.w}" height="${canvas.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(hood)}">
  <title>${esc(hood)}</title>
  <defs><style type="text/css"><![CDATA[${displayFontCss()}]]></style></defs>

  <rect width="${canvas.w}" height="${canvas.h}" fill="${BG}"/>
  ${guilloche}

  <image
    href="${hero}"
    xlink:href="${hero}"
    x="${place.x.toFixed(2)}"
    y="${place.y.toFixed(2)}"
    width="${place.width.toFixed(2)}"
    height="${place.height.toFixed(2)}"
    preserveAspectRatio="${place.preserveAspectRatio}"
    opacity="0.92"
  />

  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="RhagentDisplay, Impact, 'Arial Black', sans-serif"
    font-size="${fontSize}"
    fill="${GREEN_OLIVE}"
    fill-opacity="0.95"
    textLength="${textLength}"
    lengthAdjust="spacingAndGlyphs"
  >${esc(label)}</text>
</svg>`;
}

/** Rasterize square portrait to a typical NFT PNG (~hundreds of KB). */
export async function buildAgentPortraitPng(
  username: string,
  layout: PortraitLayout = "square",
): Promise<Buffer> {
  const svg = Buffer.from(buildAgentPortraitSvg(username, layout), "utf8");
  const size = layout === "banner" ? BANNER.w : SQUARE.w;
  return sharp(svg, { density: 96 })
    .resize(size, layout === "banner" ? BANNER.h : SQUARE.h, {
      fit: "fill",
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export function agentCertificateImageUrl(username: string, chain: "rh" | "base" = "rh"): string {
  const slug = encodeURIComponent(sanitizeNftUsername(username).toLowerCase());
  return `${getSiteBaseUrl()}/api/nft/certificate/${slug}?chain=${chain}`;
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
      { trait_type: "art", value: "guilloche-portrait" },
      { trait_type: "format", value: "png-1024" },
    ],
  };
}
