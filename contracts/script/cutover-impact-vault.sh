#!/usr/bin/env bash
# Full RhagentImpactVault v2.1 deploy + fund migration + journal cutover + RWA allowlist.
#
# Required:
#   OWNER_PRIVATE_KEY  → must control 0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5
#
# Optional:
#   AUTHORIZER_ADDRESS=0xC2D36c74E78a6D8c8Fb5AAD49145547Cb47Fb8Aa  (already on Railway)
#   SKIP_RWA_ALLOWLIST=1   — skip setTokenLimits for stock tokens (RHAGENT-only)
#   RWA_ALLOWLIST=rhj|top  — rhj = all active RHJ tokens (default); top = legacy 8 tickers
#   SKIP_RAILWAY=1         — skip railway variable update
#   DRY_RUN_GRANTS=1       — curl admin dry-run after cutover (needs ADMIN_SECRET)

set -euo pipefail

# macOS ships bash 3.2 — no ${var,,} or declare -A.
addr_eq() {
  python3 -c "import sys; sys.exit(0 if sys.argv[1].lower() == sys.argv[2].lower() else 1)" "$1" "$2"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/rwa-allowlist-lib.sh"
cd "$ROOT/contracts"

RPC="${RHAGENT_RPC_URL:-${RPC_URL:-https://rpc.mainnet.chain.robinhood.com}}"
JOURNAL="${JOURNAL_ADDRESS:-0x7bbC170871fd9d8294Fedb78080F9152D4B3fbcd}"
V1="${V1_VAULT_ADDRESS:-0x957025B7D3357B88748d35eA28e7Fa455933313D}"
RHAGENT="${RHAGENT_TOKEN:-0x894fAc757250F8E02180E1856957274D84AC4bA3}"
FUND="${FUND_AMOUNT:-96000000000000000000000}"
EXPECTED_OWNER="0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5"
AUTHORIZER="${AUTHORIZER_ADDRESS:-0xC2D36c74E78a6D8c8Fb5AAD49145547Cb47Fb8Aa}"

if [[ -z "${OWNER_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: export OWNER_PRIVATE_KEY=0x... (owner $EXPECTED_OWNER)"
  exit 1
fi

PK="$OWNER_PRIVATE_KEY"
[[ "$PK" == 0x* ]] || PK="0x$PK"
OWNER=$(cast wallet address --private-key "$PK")
if ! addr_eq "$OWNER" "$EXPECTED_OWNER"; then
  echo "ERROR: key derives to $OWNER, expected $EXPECTED_OWNER"
  exit 1
fi

echo "== 1/6 Deploy RhagentImpactVault v2.1 =="
export OWNER_PRIVATE_KEY="$PK"
export AUTHORIZER_ADDRESS="$AUTHORIZER"
if [[ -z "${RHAGENT_GRANT_AUTHORIZER_KEY:-}" && -f "../.secrets/grant-authorizer-new.json" ]]; then
  export RHAGENT_GRANT_AUTHORIZER_KEY=$(python3 -c "import json; print(json.load(open('../.secrets/grant-authorizer-new.json'))[0]['private_key'])")
fi
bash script/deploy-impact-vault.sh

V2=$(python3 -c "import json; print(json.load(open('../.secrets/impact-vault-deploy.json'))['v2_address'])")
echo "v2 vault: $V2"

BAL=$(cast call "$RHAGENT" "balanceOf(address)(uint256)" "$V1" --rpc-url "$RPC" | awk '{print $1}')
echo "v1 balance: $BAL wei"
if [[ "$BAL" == "0" || -z "$BAL" ]]; then
  echo "ERROR: v1 vault empty — aborting"
  exit 1
fi
FUND="$BAL"

echo "== 2/6 Drain $FUND from v1 → owner =="
cast send "$V1" "drain(address,uint256)" "$OWNER" "$FUND" \
  --private-key "$PK" --rpc-url "$RPC"

echo "== 3/6 Transfer RHAGENT to v2 =="
cast send "$RHAGENT" "transfer(address,uint256)" "$V2" "$FUND" \
  --private-key "$PK" --rpc-url "$RPC"

V2BAL=$(cast call "$RHAGENT" "balanceOf(address)(uint256)" "$V2" --rpc-url "$RPC" | awk '{print $1}')
echo "v2 RHAGENT balance: $V2BAL"

echo "== 4/6 journal.setRewardVault(v2) =="
cast send "$JOURNAL" "setRewardVault(address)" "$V2" \
  --private-key "$PK" --rpc-url "$RPC"

REWARD=$(cast call "$JOURNAL" "rewardVault()(address)" --rpc-url "$RPC" | awk '{print $1}')
echo "journal rewardVault: $REWARD"
if ! addr_eq "$REWARD" "$V2"; then
  echo "ERROR: journal still points at $REWARD"
  exit 1
fi

if [[ "${SKIP_RWA_ALLOWLIST:-}" != "1" ]]; then
  RWA_MODE="${RWA_ALLOWLIST:-rhj}"
  echo "== 5/6 setTokenLimits ($RWA_MODE list — allowlist only, vault unfunded in stock tokens) =="
  LIST_FILE=$(mktemp)
  trap 'rm -f "$LIST_FILE"' EXIT
  case "$RWA_MODE" in
    rhj) rwa_fetch_rhj_list "$SCRIPT_DIR" > "$LIST_FILE" ;;
    top) rwa_top8_list > "$LIST_FILE" ;;
    *) echo "ERROR: RWA_ALLOWLIST must be rhj or top"; exit 1 ;;
  esac
  rwa_apply_allowlist "$V2" "$PK" "$RPC" 0 < "$LIST_FILE"
  rm -f "$LIST_FILE"
  trap - EXIT
else
  echo "== 5/6 SKIP_RWA_ALLOWLIST=1 — RHAGENT-only on-chain =="
fi

if [[ "${SKIP_RAILWAY:-}" != "1" ]] && command -v railway >/dev/null; then
  echo "== 6/6 Railway RHAGENT_IMPACT_VAULT_ADDRESS =="
  railway variable set "RHAGENT_IMPACT_VAULT_ADDRESS=$V2" --service rhagentsite --skip-deploys
  railway redeploy -y --service rhagentsite || true
else
  echo "== 6/6 Set Railway manually =="
  echo "railway variable set RHAGENT_IMPACT_VAULT_ADDRESS=$V2 --service rhagentsite"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "DONE"
echo "  v2 vault:     $V2"
echo "  authorizer:   $AUTHORIZER"
echo "  journal → v2: $REWARD"
echo "  RHAGENT in v2: $V2BAL"
echo ""
echo "Dry-run grants:"
echo "  curl -H \"x-admin-secret: \$ADMIN_SECRET\" https://rhagent.bot/api/admin/grants"
echo "  curl -X POST -H \"x-admin-secret: \$ADMIN_SECRET\" -H 'content-type: application/json' \\"
echo "       -d '{\"dry_run\":true}' https://rhagent.bot/api/admin/grants"
echo ""
echo "RWA grants in NVDA etc. fall back to RHAGENT until you fund v2 with those tokens."
echo "══════════════════════════════════════════════════════════════"

if [[ "${DRY_RUN_GRANTS:-}" == "1" && -n "${ADMIN_SECRET:-}" ]]; then
  sleep 30
  curl -s -H "x-admin-secret: $ADMIN_SECRET" "https://rhagent.bot/api/admin/grants" | head -c 500
  echo ""
fi
