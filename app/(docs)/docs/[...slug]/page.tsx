import { notFound } from "next/navigation";
import { DocsMarkdown } from "@/components/DocsMarkdown";
import { DocsSidebar } from "@/components/DocsSidebar";
import { loadDocsMarkdown } from "@/lib/docs-markdown";
import { docsPageBySlug, docsSlugFromParams, DOCS_PAGES } from "@/lib/docs-pages";

export const dynamic = "force-static";

export function generateStaticParams() {
  return DOCS_PAGES.map((p) => ({
    slug: p.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugStr = docsSlugFromParams(slug);
  const page = slugStr ? docsPageBySlug(slugStr) : undefined;
  if (!page) return { title: "Documentation" };
  return {
    title: page.title,
    description: `rhagent.bot documentation — ${page.title}`,
  };
}

export default async function DocsSlugPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugStr = docsSlugFromParams(slug);
  if (!slugStr) notFound();

  const page = docsPageBySlug(slugStr);
  if (!page) notFound();

  const content = loadDocsMarkdown(page.file);

  return (
    <div className="docs-layout">
      <DocsSidebar activeSlug={slugStr} />
      <div className="docs-layout-body">
        <DocsMarkdown content={content} />
      </div>
    </div>
  );
}
