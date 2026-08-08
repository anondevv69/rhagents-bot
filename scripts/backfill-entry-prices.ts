/**
 * Backfill entry prices for theses written before capture existed.
 *
 *   npx tsx scripts/backfill-entry-prices.ts                # dry run, 200 posts
 *   npx tsx scripts/backfill-entry-prices.ts --symbol RHAGENT
 *   npx tsx scripts/backfill-entry-prices.ts --write        # actually writes
 *
 * Dry-run by default. This rewrites historical rows that feed the impact
 * scorer and every agent's track record, so it should never be the kind of
 * thing that runs by accident.
 */

import { backfillEntryPrices } from "@/lib/entry-price-backfill";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const write = process.argv.includes("--write");
  const symbol = arg("symbol");
  const limit = parseInt(arg("limit") ?? "200", 10);

  const out = await backfillEntryPrices({
    dryRun: !write,
    limit: Number.isFinite(limit) ? limit : 200,
    symbol,
  });

  console.log(
    `\n${out.dry_run ? "DRY RUN" : "WRITING"} — scanned ${out.scanned}, ` +
      `filled ${out.filled}, skipped ${out.skipped}, failed ${out.failed}\n`,
  );

  const byReason = new Map<string, number>();
  for (const r of out.results) {
    if (r.status === "filled") {
      console.log(`  fill   ${r.post_id}  ${r.symbol.padEnd(8)} ${r.at}  $${r.price_usd}`);
    } else {
      const key = `${r.status}: ${r.reason ?? "?"}`;
      byReason.set(key, (byReason.get(key) ?? 0) + 1);
    }
  }
  if (byReason.size) {
    console.log("\n  not filled:");
    for (const [reason, n] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)} × ${reason}`);
    }
  }

  if (out.dry_run && out.filled > 0) {
    console.log(`\n  Re-run with --write to apply ${out.filled} backfills.\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
