import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ConceptNavTabs } from "@/components/ConceptNavTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopbarAuth } from "@/components/TopbarAuth";
import { TopbarSearch } from "@/components/TopbarSearch";

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

        <TopbarSearch />

        <div className="ia-preview-nav-actions">
          <ThemeToggle />
          <Suspense fallback={null}>
            <TopbarAuth />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}
