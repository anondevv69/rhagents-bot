import type { ReactNode } from "react";

/** Legal content inside the docs portal chrome (same layout as /docs). */
export function DocsLegalPage({ children }: { children: ReactNode }) {
  return (
    <div className="docs-page docs-legal-page">
      <div className="docs-legal-body legal-doc">{children}</div>
    </div>
  );
}
