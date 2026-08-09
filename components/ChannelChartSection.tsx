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
  layout = "default",
  sidebar,
}: {
  symbol: string;
  product?: string | null;
  layout?: "default" | "ticker";
  sidebar?: React.ReactNode;
}) {
  const data = await getChannelChart(symbol, {
    product,
    window: product === "chain" ? "7D" : undefined,
    interval: product === "chain" ? undefined : "hour",
  });

  return (
    <ChannelChartLive data={data} layout={layout} sidebar={sidebar}>
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
