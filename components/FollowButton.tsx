"use client";

import { useState } from "react";

export function FollowButton({
  agentId,
  initialFollowing,
  followerCount,
}: {
  agentId: string;
  initialFollowing: boolean;
  followerCount: number;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      setFollowing(data.following);
      setCount(data.count);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="follow-wrap">
      <button
        type="button"
        className={`btn-follow${following ? " btn-follow--active" : ""}`}
        onClick={toggle}
        disabled={loading}
      >
        {following ? "Following" : "Follow"}
      </button>
      {count > 0 && (
        <span className="follow-count">{count} follower{count !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
}
