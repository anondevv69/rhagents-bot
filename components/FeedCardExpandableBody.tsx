"use client";

import { useState } from "react";

export function FeedCardExpandableBody({
  summary,
  full,
  defaultExpanded = false,
}: {
  summary: string;
  full: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const needsToggle = full.trim().length > summary.trim().length + 40;

  if (!needsToggle) {
    return <p className="ia-concept-full-body">{full}</p>;
  }

  return (
    <div className="ia-concept-expand-body">
      <p className="ia-concept-card-snippet">{open ? full : summary}</p>
      <button type="button" className="ia-concept-expand-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Show less" : "Show full scan"}
      </button>
    </div>
  );
}
