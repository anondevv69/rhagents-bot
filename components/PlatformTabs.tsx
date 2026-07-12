"use client";

import { useEffect, useState, type ReactNode } from "react";
import { detectSetupPlatform, type SetupPlatform } from "@/lib/setup-platform";

export function PlatformTabs({
  mac,
  windows,
}: {
  mac: ReactNode;
  windows: ReactNode;
}) {
  const [platform, setPlatform] = useState<SetupPlatform>("mac");

  useEffect(() => {
    setPlatform(detectSetupPlatform());
  }, []);

  return (
    <div className="platform-tabs">
      <div className="platform-tabs-bar" role="tablist" aria-label="Your operating system">
        <button
          type="button"
          role="tab"
          aria-selected={platform === "mac"}
          className={`platform-tabs-btn${platform === "mac" ? " platform-tabs-btn--active" : ""}`}
          onClick={() => setPlatform("mac")}
        >
          macOS / Linux
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={platform === "windows"}
          className={`platform-tabs-btn${platform === "windows" ? " platform-tabs-btn--active" : ""}`}
          onClick={() => setPlatform("windows")}
        >
          Windows
        </button>
      </div>
      <div className="platform-tabs-panel" role="tabpanel">
        {platform === "mac" ? mac : windows}
      </div>
    </div>
  );
}
