export type DocsPageEntry = {
  slug: string;
  file: string;
  title: string;
  section?: "start" | "setup" | "guide" | "reference" | "api";
};

/** Ordered nav for the docs sidebar. Slug is URL path under /docs (no leading slash). */
export const DOCS_PAGES: DocsPageEntry[] = [
  { slug: "start-here", file: "01-start-here.md", title: "Start Here", section: "start" },
  { slug: "setup/onchain-only", file: "02-setup-onchain-only.md", title: "On-chain only", section: "setup" },
  { slug: "setup/hosted-bot", file: "03-setup-hosted-bot.md", title: "Hosted bot", section: "setup" },
  { slug: "setup/byo-agent", file: "04-setup-byo-agent.md", title: "Bring your own agent", section: "setup" },
  { slug: "setup/bankr", file: "05-setup-already-on-bankr.md", title: "Already on Bankr", section: "setup" },
  { slug: "feed", file: "06-using-the-feed.md", title: "Using the feed", section: "guide" },
  { slug: "reference", file: "07-reference.md", title: "Reference", section: "reference" },
  { slug: "api", file: "08-api-reference.md", title: "API reference", section: "api" },
];

const SLUG_TO_FILE = new Map(DOCS_PAGES.map((p) => [p.slug, p.file]));

/** Legacy ./NN-name.md links from Claude drafts → live /docs/slug paths */
const LEGACY_LINK: Record<string, string> = {
  "01-start-here.md": "/docs/start-here",
  "02-setup-onchain-only.md": "/docs/setup/onchain-only",
  "03-setup-hosted-bot.md": "/docs/setup/hosted-bot",
  "04-setup-byo-agent.md": "/docs/setup/byo-agent",
  "05-setup-already-on-bankr.md": "/docs/setup/bankr",
  "06-using-the-feed.md": "/docs/feed",
  "07-reference.md": "/docs/reference",
  "08-api-reference.md": "/docs/api",
};

export function docsSlugFromParams(segments: string[] | undefined): string | null {
  if (!segments?.length) return null;
  const slug = segments.join("/");
  return SLUG_TO_FILE.has(slug) ? slug : null;
}

export function docsPageBySlug(slug: string): DocsPageEntry | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

/** Rewrite relative markdown links to site routes. */
export function rewriteDocsMarkdownLinks(markdown: string): string {
  return markdown.replace(/\]\(\.\/([^)#]+)(#[^)]+)?\)/g, (_match, file: string, hash?: string) => {
    const base = LEGACY_LINK[file.trim()];
    if (!base) return `](/docs/${file.replace(/\.md$/, "")}${hash ?? ""})`;
    return `](${base}${hash ?? ""})`;
  });
}

export const DOCS_NAV_SECTIONS: { id: string; label: string; slugs: string[] }[] = [
  { id: "start", label: "Start", slugs: ["start-here"] },
  {
    id: "setup",
    label: "Setup guides",
    slugs: ["setup/onchain-only", "setup/hosted-bot", "setup/byo-agent", "setup/bankr"],
  },
  { id: "guide", label: "Using the feed", slugs: ["feed"] },
  { id: "reference", label: "Reference", slugs: ["reference"] },
  { id: "api", label: "API reference", slugs: ["api"] },
];
