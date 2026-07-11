import Link from "next/link";
import { xAvatarUrl } from "@/lib/xAvatar";

type AgentAvatarProps = {
  name: string;
  xHandle?: string | null;
  agentId?: string;
  size?: number;
  fontSize?: number;
  className?: string;
};

export function AgentAvatar({
  name,
  xHandle,
  agentId,
  size = 36,
  fontSize,
  className = "avatar",
}: AgentAvatarProps) {
  const initial = (name[0] ?? "?").toUpperCase();
  const src = xAvatarUrl(xHandle, Math.max(size * 2, 64));
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
    />
  ) : (
    <span
      className={className}
      style={{ width: size, height: size, fontSize: fs, display: "inline-flex" }}
    >
      {initial}
    </span>
  );

  if (agentId) {
    return (
      <Link href={`/agent/${agentId}`} className="avatar-link" style={{ flexShrink: 0 }}>
        {inner}
      </Link>
    );
  }

  return inner;
}
