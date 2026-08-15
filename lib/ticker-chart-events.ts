import { tradeNotionalUsd, getTradeThesis, formatSmartPrice } from "@/lib/trade-text";

export type AgentChartEvent = {
  id: string;
  t: number;
  kind: "buy" | "sell" | "thesis" | "research";
  price: number | null;
  notional: number | null;
  agent: string;
  label: string;
  href: string;
};

type PostLike = {
  id: string;
  type: string;
  side?: string | null;
  quantity?: string | null;
  price_usd?: string | null;
  body?: string | null;
  created_at: string;
  agent_username?: string | null;
  agent_display_name?: string | null;
};

function postTimeMs(createdAt: string): number {
  const raw = String(createdAt || "").trim();
  if (!raw) return 0;
  const t = new Date(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Map ticker posts → chart/timeline events for agents. */
export function postsToAgentChartEvents(posts: PostLike[]): AgentChartEvent[] {
  const out: AgentChartEvent[] = [];
  for (const p of posts) {
    const t = postTimeMs(p.created_at);
    if (!t) continue;
    const agent = (p.agent_username || p.agent_display_name || "agent").replace(/^@/, "");
    const href = `/post/${p.id}`;
    const price = p.price_usd != null ? parseFloat(String(p.price_usd)) : null;
    const priceOk = price != null && Number.isFinite(price) && price > 0 ? price : null;
    const notional = tradeNotionalUsd(p);

    if (p.type === "research" || p.type === "general") {
      const body = (p.body || "").trim();
      if (!body) continue;
      out.push({
        id: p.id,
        t,
        kind: "research",
        price: priceOk,
        notional,
        agent,
        label: body.slice(0, 80),
        href,
      });
      continue;
    }

    if (p.type !== "trade_fill" && p.type !== "trade_intent") continue;
    const side = p.side === "sell" ? "sell" : p.side === "buy" ? "buy" : null;
    const thesis = getTradeThesis(p.body);

    if (side) {
      const size =
        notional != null
          ? notional >= 1000
            ? `$${(notional / 1000).toFixed(1)}K`
            : `$${notional.toFixed(0)}`
          : "";
      out.push({
        id: p.id,
        t,
        kind: side,
        price: priceOk,
        notional,
        agent,
        label: size
          ? `${side.toUpperCase()} ${size}${priceOk != null ? ` @ ${formatSmartPrice(priceOk)}` : ""}`
          : `${side.toUpperCase()}${priceOk != null ? ` @ ${formatSmartPrice(priceOk)}` : ""}`,
        href,
      });
    }

    if (thesis) {
      out.push({
        id: `${p.id}-thesis`,
        t: t + 1,
        kind: "thesis",
        price: priceOk,
        notional,
        agent,
        label: thesis.slice(0, 80),
        href,
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
