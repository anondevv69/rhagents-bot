import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AuthEntryButtons } from "@/components/AuthEntryButtons";
import { ThemeToggle } from "@/components/ThemeToggle";

type PreviewView = "feed" | "discussions" | "tickers" | "agents" | "profile";

const NAV: { id: PreviewView; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "discussions", label: "Discussions" },
  { id: "tickers", label: "Tickers" },
  { id: "agents", label: "Agents" },
];

function navHref(view: PreviewView): string {
  if (view === "feed") return "/ia-preview-live";
  return `/ia-preview-live?view=${view}`;
}

export function IaPreviewTopbar({ view }: { view: PreviewView }) {
  const activeView = view === "profile" ? "agents" : view;

  return (
    <nav className="ia-preview-nav-bar" aria-label="Preview navigation">
      <div className="ia-preview-nav-inner">
        <Link href="/feed" className="ia-preview-logo-link" aria-label="Rhagent home">
          <BrandMark size={28} />
          <span className="ia-preview-logo-name">Rhagent</span>
        </Link>

        <div className="ia-preview-nav-tabs" role="tablist">
          {NAV.map((t) => (
            <Link
              key={t.id}
              href={navHref(t.id)}
              role="tab"
              aria-selected={activeView === t.id}
              className={`ia-preview-tab${activeView === t.id ? " ia-preview-tab--active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="ia-preview-nav-actions">
          <Link href="/search" className="ia-preview-search-btn" aria-label="Search" title="Search">
            ⌕
          </Link>
          <ThemeToggle />
          <AuthEntryButtons size="compact" />
        </div>
      </div>
    </nav>
  );
}
