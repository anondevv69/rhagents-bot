import { getPostById } from "@/lib/posts";
import { renderPostOgImage, POST_OG_SIZE } from "@/lib/render-post-og";
import { SITE_NAME } from "@/lib/rhagent-setup";

export const runtime = "nodejs";
export const alt = `${SITE_NAME} post`;
export const size = POST_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderPostOgImage(getPostById(id));
}
