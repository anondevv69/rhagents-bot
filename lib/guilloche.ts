/** Deterministic guilloché params + SVG — portable to on-chain tokenURI later. */

export type GuillocheChain = "rh" | "base";

export const CHAIN_PALETTE: Record<
  GuillocheChain,
  { hue: number; sat: number; label: string }
> = {
  rh: { hue: 140, sat: 65, label: "ROBINHOOD" },
  base: { hue: 220, sat: 70, label: "BASE" },
};

export function seedBytes(input: string, n = 32): number[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out.push(((t ^ (t >>> 14)) >>> 0) & 0xff);
  }
  return out;
}

export function paramsFromSeed(b: number[]) {
  return {
    freq_a: 0.005 + (b[0] / 255) * 0.01,
    freq_b: 0.003 + (b[1] / 255) * 0.008,
    phase_a: 0.12 + (b[2] / 255) * 0.3,
    phase_b: 0.08 + (b[3] / 255) * 0.25,
    amp_base: 3 + (b[4] / 255) * 4,
    amp_gain: 8 + (b[5] / 255) * 10,
    amp_pow: 1.3 + (b[6] / 255) * 0.8,
    rot_a: (b[7] / 255) * 16 - 8,
    rot_b: (b[8] / 255) * 16 - 8 + 6,
    lineCount: 140 + (b[9] % 60),
    accentShift: (b[10] / 255) * 40 - 20,
    token: (b[10] << 8) | b[11],
    hashHex: b
      .slice(0, 8)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export type GuillocheParams = ReturnType<typeof paramsFromSeed>;

export function buildLines(
  p: GuillocheParams,
  W: number,
  H: number,
  phaseKey: "phase_a" | "phase_b",
  freqKey: "freq_a" | "freq_b",
  opts: { yInset?: number; xPad?: number; step?: number; lineCount?: number } = {},
): string[] {
  const yInset = opts.yInset ?? 100;
  const xPad = opts.xPad ?? 0;
  const step = opts.step ?? 4;
  const out: string[] = [];
  const n = Math.max(2, opts.lineCount ?? p.lineCount);
  for (let i = 0; i < n; i++) {
    const r = i / (n - 1);
    const amp = p.amp_base + p.amp_gain * Math.pow(r, p.amp_pow);
    const baseY = yInset + r * (H - 2 * yInset);
    const pts: string[] = [];
    for (let x = -xPad; x <= W + xPad; x += step) {
      const y =
        baseY +
        amp * Math.sin(x * p[freqKey] + i * p[phaseKey]) +
        amp * 0.4 * Math.sin(x * p.freq_b * 0.7 - i * p[phaseKey] * 0.6);
      pts.push(`${x},${y.toFixed(2)}`);
    }
    out.push(pts.join(" "));
  }
  return out;
}

export function sanitizeAgentKey(raw: string): string {
  return (
    raw
      .trim()
      .replace(/^@/, "")
      .replace(/^rhagent\./i, "")
      .replace(/\.hood$/i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "")
      .slice(0, 40) || "agent"
  );
}

export function guillocheDisplayName(agentKey: string): string {
  return `RHAGENT.${sanitizeAgentKey(agentKey).toUpperCase()}`;
}

/** Subtle banknote-style guilloché layers (for portrait background). */
export function buildGuillocheBackdropMarkup(opts: {
  agentKey: string;
  width: number;
  height: number;
  /** Soft gray security lines (matches hero+guilloché comps). */
  style?: "security" | "chain";
  chain?: GuillocheChain;
  /** Coarser mesh for smaller PNG rasterization. */
  density?: "full" | "compact";
}): string {
  const agentKey = sanitizeAgentKey(opts.agentKey);
  const seed = seedBytes(agentKey, 32);
  const p = paramsFromSeed(seed);
  const W = opts.width;
  const H = opts.height;
  const fullBleed = opts.style !== "chain";
  const compact = opts.density === "compact";

  // Oversized field + clip so rotation still fills corners edge-to-edge
  const scale = fullBleed ? 1.45 : 1;
  const OW = W * scale;
  const OH = H * scale;
  const ox = (W - OW) / 2;
  const oy = (H - OH) / 2;
  const lineOpts = fullBleed
    ? {
        yInset: 0,
        xPad: 0,
        step: compact ? 10 : 5,
        lineCount: compact ? 90 : Math.max(p.lineCount, 180),
      }
    : { yInset: 100, step: 4 };

  const layerA = buildLines(p, OW, OH, "phase_a", "freq_a", lineOpts);
  const layerB = buildLines(p, OW, OH, "phase_b", "freq_b", lineOpts);

  let col1: string;
  let col2: string;
  let opA: number;
  let opB: number;
  if (opts.style === "chain") {
    const palette = CHAIN_PALETTE[opts.chain ?? "rh"];
    const hue2 = (palette.hue + p.accentShift + 360) % 360;
    col1 = `hsl(${palette.hue} ${palette.sat}% 55%)`;
    col2 = `hsl(${hue2} ${palette.sat - 10}% 60%)`;
    opA = 0.55;
    opB = 0.4;
  } else {
    // Charcoal security paper — readable guilloché like the hybrid example
    col1 = "#8a9280";
    col2 = "#6e7668";
    opA = 0.5;
    opB = 0.36;
  }

  const strokeA = fullBleed ? 0.9 : 0.55;
  const strokeB = fullBleed ? 0.7 : 0.55;
  const clipId = `gc-${seed.slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  const linesA = layerA
    .map(
      (pts) =>
        `<polyline points="${pts}" fill="none" stroke="${col1}" stroke-width="${strokeA}" opacity="${opA}"/>`,
    )
    .join("");
  const linesB = layerB
    .map(
      (pts) =>
        `<polyline points="${pts}" fill="none" stroke="${col2}" stroke-width="${strokeB}" opacity="${opB}"/>`,
    )
    .join("");

  const cx = OW / 2;
  const cy = OH / 2;
  return `<defs><clipPath id="${clipId}"><rect width="${W}" height="${H}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">
    <g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)})">
      <g transform="rotate(${p.rot_a.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})">${linesA}</g>
      <g transform="rotate(${p.rot_b.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})">${linesB}</g>
    </g>
  </g>`;
}

export function buildGuillocheCertificateSvg(opts: {
  agentKey: string;
  chain?: GuillocheChain;
  anchoredAt?: string;
}): string {
  const agentKey = sanitizeAgentKey(opts.agentKey);
  const chain = opts.chain ?? "rh";
  const anchoredAt = opts.anchoredAt ?? new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const seed = seedBytes(agentKey, 32);
  const p = paramsFromSeed(seed);
  const palette = CHAIN_PALETTE[chain];
  const W = 800;
  const H = 800;
  const display = guillocheDisplayName(agentKey);
  const fontSize = display.length <= 18 ? 44 : Math.max(22, Math.floor((44 * 18) / display.length));

  const hue1 = palette.hue;
  const textCol = `hsl(${hue1} ${palette.sat}% 65%)`;
  const col1 = `hsl(${hue1} ${palette.sat}% 55%)`;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const backdrop = buildGuillocheBackdropMarkup({
    agentKey,
    width: W,
    height: H,
    style: "chain",
    chain,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(display)}">
  <rect width="${W}" height="${H}" fill="#0a0d0a"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${col1}" stroke-width="1" opacity="0.55"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${col1}" stroke-width="0.4" opacity="0.35"/>
  ${backdrop}
  <rect x="0" y="0" width="${W}" height="88" fill="#0a0d0a" opacity="0.7"/>
  <rect x="0" y="${H - 96}" width="${W}" height="96" fill="#0a0d0a" opacity="0.7"/>
  <text x="${W / 2}" y="62" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${fontSize}" fill="${textCol}" letter-spacing="2">${esc(display)}</text>
  <text x="40" y="${H - 56}" font-family="ui-monospace, Menlo, monospace" font-size="12" fill="${textCol}" opacity="0.85">KEY  ${p.hashHex}</text>
  <text x="40" y="${H - 36}" font-family="ui-monospace, Menlo, monospace" font-size="11" fill="${textCol}" opacity="0.6">ANCHORED  ${esc(anchoredAt)}</text>
  <text x="${W - 40}" y="${H - 56}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="12" fill="${textCol}" opacity="0.85">#${String(p.token).padStart(5, "0")}</text>
  <text x="${W - 40}" y="${H - 36}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="11" fill="${textCol}" opacity="0.6">CHAIN  ${palette.label}</text>
</svg>`;
}
