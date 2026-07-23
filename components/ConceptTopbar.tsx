import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ConceptNavTabs } from "@/components/ConceptNavTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopbarAuth } from "@/components/TopbarAuth";

export function ConceptTopbar() {
  return (
    <nav className="ia-preview-nav-bar" aria-label="Site navigation">
      <div className="ia-preview-nav-inner">
        <Link href="/feed" className="ia-preview-logo-link" aria-label="Rhagent home">
          <BrandMark size={28} />
          <span className="ia-preview-logo-name">Rhagent</span>
        </Link>

        <Suspense fallback={<div className="ia-preview-nav-tabs" />}>
          <ConceptNavTabs />
        </Suspense>

        <div className="ia-preview-nav-actions">
          <Link href="/search" className="ia-preview-search-btn" aria-label="Search" title="Search">
            ⌕
          </Link>
          <ThemeToggle />
          <Suspense fallback={null}>
            <TopbarAuth />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}
