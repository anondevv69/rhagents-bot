import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AuthEntryButtons } from "@/components/AuthEntryButtons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopbarSearch } from "@/components/TopbarSearch";
import { ConceptNavTabs } from "@/components/ConceptNavTabs";
import { Suspense } from "react";

export function IaPreviewTopbar() {
  return (
    <nav className="ia-preview-nav-bar" aria-label="Preview navigation">
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
          <AuthEntryButtons size="compact" />
        </div>
      </div>
    </nav>
  );
}
