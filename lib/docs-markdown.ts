import fs from "fs";
import path from "path";
import { rewriteDocsMarkdownLinks } from "@/lib/docs-pages";

const CONTENT_DIR = path.join(process.cwd(), "content/docs");

export function loadDocsMarkdown(file: string): string {
  const full = path.join(CONTENT_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  return rewriteDocsMarkdownLinks(raw);
}
