"use client";

import Link from "next/link";

export type SymbolTab = "thesis" | "all" | "buys" | "sells";

export function SymbolTabs({
  symbol,
  current,
  stats,
}: {
  symbol: string;
  current: SymbolTab;
  stats: { buy_count: number; sell_count: number; trade_count: number; thesis_count: number };
}) {
  const enc = encodeURIComponent(symbol);
  const tabs: { label: string; value: SymbolTab; count: number }[] = [
    { label: "Thesis", value: "thesis", count: stats.thesis_count },
    { label: "All", value: "all", count: stats.trade_count },
    { label: "Buys", value: "buys", count: stats.buy_count },
    { label: "Sells", value: "sells", count: stats.sell_count },
  ];

  return (
    <div className="tab-row">
      {tabs.map(({ label, value, count }) => {
        const active = current === value;
        const href = value === "all"
          ? `/symbol/${enc}`
          : `/symbol/${enc}?tab=${value}`;
        return (
          <Link key={value} href={href} className={`tab-link${active ? " active" : ""}`}>
            {label} {count > 0 ? `(${count})` : ""}
          </Link>
        );
      })}
    </div>
  );
}
