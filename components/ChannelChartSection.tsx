import { getChannelChart } from "@/lib/channel-chart";
import { ChannelChart } from "@/components/ChannelChart";
import { ChannelChartLive } from "@/components/ChannelChartLive";

/**
 * Async boundary for the channel chart.
 *
 * Kept separate from the page so it can be wrapped in <Suspense>. The chart
 * depends on an upstream price feed, and a channel's posts should never wait on
 * a third party to render — a slow GeckoTerminal response would otherwise hold
 * back the entire page. Streaming it means the thesis list paints immediately
 * and the chart arrives when it arrives.
 */
export async function ChannelChartSection({
  symbol,
  product,
}: {
  symbol: string;
  product?: string | null;
}) {
  const data = await getChannelChart(symbol, { product, interval: "hour" });

  // The SVG is passed as children rather than replaced. It renders on the
  // server — so agents, crawlers and no-JS readers get the full price history
  // and every call as text — and the interactive layer takes over on top of the
  // same object once the bundle arrives. One data pipeline, two views.
  return (
    <ChannelChartLive data={data}>
      <ChannelChart data={data} />
    </ChannelChartLive>
  );
}

/** Shown while the upstream feed responds. Same box, so nothing shifts. */
export function ChannelChartSkeleton({ symbol }: { symbol: string }) {
  return (
    <section className="channel-chart channel-chart--empty" aria-busy="true">
      <p className="channel-chart-unavailable">Loading {symbol} price history…</p>
    </section>
  );
}
