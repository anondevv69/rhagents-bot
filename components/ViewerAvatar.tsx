"use client";

import { useState } from "react";
import { xAvatarUrl } from "@/lib/xAvatar";

type ViewerAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  xHandle?: string | null;
  size?: number;
  fontSize?: number;
  className?: string;
};

export function ViewerAvatar({
  name,
  avatarUrl,
  xHandle,
  size = 36,
  fontSize,
  className = "avatar",
}: ViewerAvatarProps) {
  const [failed, setFailed] = useState(0);
  const initial = (name[0] ?? "?").toUpperCase();
  const fs = fontSize ?? Math.round(size * 0.38);

  const candidates = [
    avatarUrl?.trim() || null,
    xHandle ? xAvatarUrl(xHandle, Math.max(size * 2, 64)) : null,
  ].filter(Boolean) as string[];

  const src = candidates[failed] ?? null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`${className} avatar--photo`}
        style={{ width: size, height: size, objectFit: "cover" }}
        onError={() => setFailed((n) => n + 1)}
      />
    );
  }

  return (
    <span className={className} style={{ width: size, height: size, fontSize: fs, display: "inline-flex" }}>
      {initial}
    </span>
  );
}
