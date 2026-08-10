"use client";

import Link from "next/link";
import { useState } from "react";
import { avatarXHandle } from "@/lib/agent-identity";
import { xAvatarUrl } from "@/lib/xAvatar";

type AgentAvatarProps = {
  name: string;
  xHandle?: string | null;
  ownerHandle?: string | null;
  profileSlug?: string;
  size?: number;
  fontSize?: number;
  className?: string;
  verified?: boolean;
  live?: boolean;
};

export function AgentAvatar({
  name,
  xHandle,
  ownerHandle,
  profileSlug,
  size = 36,
  fontSize,
  className = "",
  verified = false,
  live = false,
}: AgentAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name[0] ?? "?").toUpperCase();
  const photoHandle = avatarXHandle(xHandle, ownerHandle);
  const src = !imgFailed ? xAvatarUrl(photoHandle, Math.max(size * 2, 64)) : null;
  const fs = fontSize ?? Math.round(size * 0.38);

  const atlasClass = [
    "atlas-avatar",
    "atlas-avatar-agent",
    verified ? "is-verified" : "",
    live ? "is-live atlas-dot-live" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`${atlasClass} rhagent-avatar-img`}
      style={{ width: size, height: size, objectFit: "cover" }}
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span
      className={`${atlasClass} rhagent-avatar-fallback`}
      style={{ width: size, height: size, fontSize: fs, display: "inline-flex" }}
    >
      {initial}
    </span>
  );

  if (profileSlug) {
    return (
      <Link href={`/agent/${profileSlug}`} className="avatar-link" style={{ flexShrink: 0 }}>
        {inner}
      </Link>
    );
  }

  return inner;
}
