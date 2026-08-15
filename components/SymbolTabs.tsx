"use client";

import Link from "next/link";

export type SymbolTab = "thesis" | "all" | "buys" | "sells";

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
  const enc = encodeURIComponent(symbol);
  const base = basePath ?? `/tickers/${enc}`;
  const allCount = stats.post_count ?? stats.trade_count;
  const tabs: { label: string; value: SymbolTab; count: number }[] = [
    { label: "All", value: "all", count: allCount },
    { label: "Buys", value: "buys", count: stats.buy_count },
    { label: "Sells", value: "sells", count: stats.sell_count },
    { label: "Thesis & research", value: "thesis", count: stats.thesis_count },
  ];

  return (
    <div className="atlas-tabbar">
      {tabs.map(({ label, value, count }) => {
        const active = current === value;
        const url = new URL(base, "https://rhagent.bot");
        if (value !== "all") url.searchParams.set("tab", value);
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
