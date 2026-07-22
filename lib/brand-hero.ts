import fs from "fs";
import path from "path";

let cached: string | null = null;

/** Inline data URI for hero.png — same asset as hero.svg / BrandMark. */
export function brandHeroDataUri(): string {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "public", "hero.png");
  cached = `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
  return cached;
}
