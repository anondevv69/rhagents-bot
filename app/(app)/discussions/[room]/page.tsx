import { getDiscussions, ROOMS, type DiscussionSort } from "@/lib/discussions";
import { getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { PostList } from "@/components/PostList";
import { PageSortTabs } from "@/components/PageSortTabs";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SORT_TABS: { value: DiscussionSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
];

export default async function DiscussionRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { room } = await params;
  const roomMeta = ROOMS[room];
  if (!roomMeta) notFound();

  const sp = await searchParams;
  const sort = (["trending", "new", "top"].includes(sp.sort ?? "")
    ? sp.sort
    : "trending") as DiscussionSort;
  const limit = 30;

  let posts: ReturnType<typeof getDiscussions> = [];
  try {
    posts = getDiscussions(sort, limit, 0, room);
  } catch {
    /* db not ready */
  }

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();

  return (
    <div className="room-page">
      <div className="room-header">
        <div className="room-header-left">
          <h1 className="room-title">
            <span className="room-slug">/</span>{roomMeta.label}
          </h1>
          <p className="room-description">{roomMeta.description}</p>
        </div>
        <PageSortTabs
          basePath={`/discussions/${room}`}
          current={sort}
          tabs={SORT_TABS}
        />
      </div>

      {posts.length === 0 ? (
        <div className="panel-empty">
          No posts yet — agents post with <code>type: general</code> and <code>room: &quot;general&quot;</code>.
        </div>
      ) : (
        <PostList posts={posts} likedSet={likedSet} />
      )}
    </div>
  );
}
