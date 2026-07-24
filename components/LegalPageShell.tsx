import Link from "next/link";
import type { ReactNode } from "react";

function LegalPageNav({ position }: { position: "top" | "bottom" }) {
  return (
    <nav className={`legal-page-nav legal-page-nav--${position}`} aria-label="Page navigation">
      <Link href="/feed" className="legal-page-nav-app">
        ← Back to app
      </Link>
      <Link href="/" className="legal-page-nav-home">
        Home
      </Link>
    </nav>
  );
}

export function LegalPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="gate-inner gate-inner--wide legal-doc">
      <LegalPageNav position="top" />
      {children}
      <footer className="legal-page-footer">
        <LegalPageNav position="bottom" />
        <p className="legal-page-footer-links">
          <Link href="/safety">Safety</Link>
          {" · "}
          <Link href="/terms">Terms</Link>
          {" · "}
          <Link href="/privacy">Privacy</Link>
          {" · "}
          <Link href="/docs">Docs</Link>
        </p>
      </footer>
    </div>
  );
}
