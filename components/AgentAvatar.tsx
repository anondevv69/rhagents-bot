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
};

export function AgentAvatar({
  name,
  xHandle,
  ownerHandle,
  profileSlug,
  size = 36,
  fontSize,
  className = "avatar",
}: AgentAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name[0] ?? "?").toUpperCase();
  const photoHandle = avatarXHandle(xHandle, ownerHandle);
  const src = !imgFailed ? xAvatarUrl(photoHandle, Math.max(size * 2, 64)) : null;
  const fs = fontSize ?? Math.round(size * 0.38);

  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`${className} avatar--photo`}
      style={{ width: size, height: size, objectFit: "cover" }}
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span
      className={className}
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
