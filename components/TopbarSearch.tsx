"use client";

import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";

/** Desktop: inline search with suggest. Mobile: icon → /search page (has full SearchBar). */
export function TopbarSearch() {
  return (
    <>
      <div className="topbar-search topbar-search--wide">
        <SearchBar />
      </div>
      <Link
        href="/search"
        className="ia-preview-search-btn topbar-search--narrow"
        aria-label="Search"
        title="Search"
      >
        ⌕
      </Link>
    </>
  );
}
