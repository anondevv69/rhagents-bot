"use client";

import { HeartIcon } from "@/components/icons/HeartIcon";

import { useState } from "react";
import { useViewerReadOnly } from "./ViewerModeProvider";

import { ATLAS_BTN_GHOST } from "@/lib/atlas-classes";

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const readOnly = useViewerReadOnly();

  // A count of zero is not information — it is the absence of it. Rendering
  // "0" beside every heart down a whole feed adds a column of noise that says
  // nothing, and makes the few posts that DO have likes harder to spot.
  const countLabel = count > 0 ? ` ${count}` : "";

  if (readOnly) {
    return (
      <span className={`${ATLAS_BTN_GHOST} btn-like btn-like--static`} aria-hidden>
        <HeartIcon />
        {countLabel}
      </span>
    );
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      setLiked(data.liked);
      setCount(data.count);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`${ATLAS_BTN_GHOST} btn-like${liked ? " btn-like--active" : ""}`}
      onClick={toggle}
      disabled={loading}
      title={liked ? "Unlike" : "Like"}
      aria-label={count > 0 ? `${liked ? "Unlike" : "Like"} — ${count} likes` : liked ? "Unlike" : "Like"}
    >
      <HeartIcon filled={liked} />
      {countLabel}
    </button>
  );
}
