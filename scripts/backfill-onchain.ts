/**
 * Local/ops CLI for NFT airdrop + post inscription backfill.
 *
 *   npx tsx scripts/backfill-onchain.ts --limit 20
 *   npx tsx scripts/backfill-onchain.ts --agents-only --limit 50
 *   npx tsx scripts/backfill-onchain.ts --posts-only --limit 100
 *   npx tsx scripts/backfill-onchain.ts --dry-run
 *
 * Requires RHAGENT_* env vars (or Railway shell).
 */
import { backfillOnchain } from "../lib/inscriber";
import { getOnchainConfig } from "../lib/onchain-config";

async function main() {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 25;

  const cfg = getOnchainConfig();
  console.log("enabled", cfg.enabled, "registry", cfg.registryAddress);

  const result = await backfillOnchain({
    agents: !args.has("--posts-only"),
    posts: !args.has("--agents-only"),
    limit,
    dryRun: args.has("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
