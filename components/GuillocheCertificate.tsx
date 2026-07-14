"use client";

import { useMemo } from "react";
import {
  buildLines,
  CHAIN_PALETTE,
  guillocheDisplayName,
  paramsFromSeed,
  sanitizeAgentKey,
  seedBytes,
  type GuillocheChain,
} from "@/lib/guilloche";

interface Props {
  agentKey: string;
  chain?: GuillocheChain;
  anchoredAt?: string;
  className?: string;
}

export function GuillocheCertificate({
  agentKey,
  chain = "rh",
  anchoredAt = "2026.07.14",
  className,
}: Props) {
  const { p, layerA, layerB, palette, display, fontSize } = useMemo(() => {
    const key = sanitizeAgentKey(agentKey);
    const seed = seedBytes(key, 32);
    const p = paramsFromSeed(seed);
    const palette = CHAIN_PALETTE[chain];
    const layerA = buildLines(p, 800, 800, "phase_a", "freq_a");
    const layerB = buildLines(p, 800, 800, "phase_b", "freq_b");
    const display = guillocheDisplayName(key);
    const fontSize = display.length <= 18 ? 44 : Math.max(22, Math.floor((44 * 18) / display.length));
    return { p, layerA, layerB, palette, display, fontSize };
  }, [agentKey, chain]);

  const W = 800;
  const H = 800;
  const hue1 = palette.hue;
  const hue2 = (palette.hue + p.accentShift + 360) % 360;
  const col1 = `hsl(${hue1} ${palette.sat}% 55%)`;
  const col2 = `hsl(${hue2} ${palette.sat - 10}% 60%)`;
  const textCol = `hsl(${hue1} ${palette.sat}% 65%)`;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={display}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <rect width={W} height={H} fill="#0a0d0a" />
      <rect x={16} y={16} width={W - 32} height={H - 32} fill="none" stroke={col1} strokeWidth={1} opacity={0.55} />
      <rect x={24} y={24} width={W - 48} height={H - 48} fill="none" stroke={col1} strokeWidth={0.4} opacity={0.35} />

      <g transform={`rotate(${p.rot_a.toFixed(2)} ${W / 2} ${H / 2})`}>
        {layerA.map((pts, i) => (
          <polyline key={`a${i}`} points={pts} fill="none" stroke={col1} strokeWidth={0.55} opacity={0.55} />
        ))}
      </g>
      <g transform={`rotate(${p.rot_b.toFixed(2)} ${W / 2} ${H / 2})`}>
        {layerB.map((pts, i) => (
          <polyline key={`b${i}`} points={pts} fill="none" stroke={col2} strokeWidth={0.55} opacity={0.4} />
        ))}
      </g>

      <rect x={0} y={0} width={W} height={88} fill="#0a0d0a" opacity={0.7} />
      <rect x={0} y={H - 96} width={W} height={96} fill="#0a0d0a" opacity={0.7} />

      <text
        x={W / 2}
        y={62}
        textAnchor="middle"
        fontFamily="Impact, 'Arial Black', sans-serif"
        fontSize={fontSize}
        fill={textCol}
        letterSpacing={2}
      >
        {display}
      </text>

      <text x={40} y={H - 56} fontFamily="ui-monospace, Menlo, monospace" fontSize={12} fill={textCol} opacity={0.85}>
        KEY  {p.hashHex}
      </text>
      <text x={40} y={H - 36} fontFamily="ui-monospace, Menlo, monospace" fontSize={11} fill={textCol} opacity={0.6}>
        ANCHORED  {anchoredAt}
      </text>
      <text
        x={W - 40}
        y={H - 56}
        textAnchor="end"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize={12}
        fill={textCol}
        opacity={0.85}
      >
        #{String(p.token).padStart(5, "0")}
      </text>
      <text
        x={W - 40}
        y={H - 36}
        textAnchor="end"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize={11}
        fill={textCol}
        opacity={0.6}
      >
        CHAIN  {palette.label}
      </text>
    </svg>
  );
}
