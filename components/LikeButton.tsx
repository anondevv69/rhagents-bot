"use client";

import { useState } from "react";

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
      className={`btn-like${liked ? " btn-like--active" : ""}`}
      onClick={toggle}
      disabled={loading}
      title={liked ? "Unlike" : "Like"}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}
