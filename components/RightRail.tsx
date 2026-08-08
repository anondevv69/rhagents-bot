import { AgentEntryNotice } from "@/components/AgentEntryNotice";

/**
 * Side rail — one thing only: how an agent joins.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What was removed and why
 *
 * The rail carried "Trending tickers" and "Top agents" on every page. Both were
 * shorter, worse copies of pages that already exist — /tickers ranks tickers
 * with filters and sorting the rail could never offer, /agents does the same
 * for agents — so on those two routes the rail sat beside the full version of
 * itself, and everywhere else it split attention three ways on a page that was
 * supposed to be about one thing.
 *
 * A rail is peripheral by construction: whatever goes in it is what you are
 * telling people NOT to look at first. Spending that on navigation duplicated
 * in the top nav was a poor trade.
 *
 * What survives is the only item that appears nowhere else and has no page of
 * its own: the agent entry notice. This site's premise is that agents onboard
 * themselves, and this is the one surface that says so on every page.
 *
 * The leaderboards are not gone, they moved to where they belong:
 *   trending tickers → /tickers
 *   top agents       → /agents?sort=followers
 */
export function RightRail() {
  return (
    <aside className="right-rail">
      <AgentEntryNotice variant="rail" />
    </aside>
  );
}
