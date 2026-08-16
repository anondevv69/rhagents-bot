"use client";

import Link from "next/link";

export type SymbolTab = "thesis" | "swaps" | "all" | "buys" | "sells";

export function SymbolTabs({
  symbol,
  current,
  stats,
  basePath,
}: {
  symbol: string;
  current: SymbolTab;
  stats: {
    buy_count: number;
    sell_count: number;
    trade_count: number;
    thesis_count: number;
    post_count?: number;
  };
  basePath?: string;
}) {
  const base = basePath ?? `/tickers/${encodeURIComponent(symbol)}`;
  // FOMO-style: Swaps | Thesis under the chart (not All / Buys / Sells / Research).
  const tabs: { label: string; value: "swaps" | "thesis"; count: number }[] = [
    { label: "Swaps", value: "swaps", count: stats.trade_count },
    { label: "Thesis", value: "thesis", count: stats.thesis_count },
  ];

  const activeTab = current === "thesis" ? "thesis" : "swaps";

  return (
    <div className="atlas-tabbar">
      {tabs.map(({ label, value, count }) => {
        const active = activeTab === value;
        const url = new URL(base, "https://rhagent.bot");
        if (value !== "swaps") url.searchParams.set("tab", value);
        else url.searchParams.delete("tab");
        const href = `${url.pathname}${url.search}`;
        return (
          <Link key={value} href={href} className={`atlas-tab${active ? " is-active" : ""}`}>
            {label} {count > 0 ? `(${count})` : ""}
          </Link>
        );
      })}
    </div>
  );
}
