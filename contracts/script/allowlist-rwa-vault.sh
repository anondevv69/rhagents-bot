#!/usr/bin/env bash
# Bulk-allowlist RHJ stock tokens on RhagentImpactVault v2 via setTokenLimits.
#
# Safe to re-run: skips tokens already allowed (RWA_SKIP_ALREADY=1, default).
#
# Required:
#   OWNER_PRIVATE_KEY  → vault owner (0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5)
#
# Optional:
#   VAULT_ADDRESS=0xac3e9e30313969010b53560cdfDfC0Ac364A96E7
#   RPC_URL=https://rpc.mainnet.chain.robinhood.com
#   RWA_ALLOWLIST=rhj|top|file   (default rhj — all active RHJ tokens)
#   RWA_ALLOWLIST_FILE=/path/to/sym:addr lines
#   DRY_RUN=1                    — print cast commands, do not send
#   GENERATE_BATCH=1             — write allowlist-rwa.batch.sh and exit
#   RWA_SKIP_ALREADY=0           — re-set limits even if already allowed
#   RWA_MAX_POST / RWA_DAILY / RWA_WALLET — cap overrides (18-decimal units)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/rwa-allowlist-lib.sh"

RPC="${RHAGENT_RPC_URL:-${RPC_URL:-https://rpc.mainnet.chain.robinhood.com}}"
EXPECTED_OWNER="0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5"
MODE="${RWA_ALLOWLIST:-rhj}"

if [[ -z "${OWNER_PRIVATE_KEY:-}" && -z "${DRY_RUN:-}" ]]; then
  echo "ERROR: export OWNER_PRIVATE_KEY=0x... (owner $EXPECTED_OWNER)"
  exit 1
fi

PK="${OWNER_PRIVATE_KEY:-}"
if [[ -n "$PK" ]]; then
  [[ "$PK" == 0x* ]] || PK="0x$PK"
  OWNER=$(cast wallet address --private-key "$PK")
  if ! python3 -c "import sys; sys.exit(0 if sys.argv[1].lower() == sys.argv[2].lower() else 1)" "$OWNER" "$EXPECTED_OWNER"; then
    echo "ERROR: key derives to $OWNER, expected $EXPECTED_OWNER"
    exit 1
  fi
fi

VAULT="${VAULT_ADDRESS:-}"
if [[ -z "$VAULT" && -f "$ROOT/.secrets/impact-vault-deploy.json" ]]; then
  VAULT=$(python3 -c "import json; print(json.load(open('$ROOT/.secrets/impact-vault-deploy.json'))['v2_address'])")
fi
VAULT="${VAULT:-0xac3e9e30313969010b53560cdfDfC0Ac364A96E7}"

echo "Vault:  $VAULT"
echo "RPC:    $RPC"
echo "Mode:   $MODE"
rwa_allowlist_defaults
echo "Caps:   max/post=$RWA_MAX_POST daily=$RWA_DAILY wallet/day=$RWA_WALLET"

LIST_FILE=$(mktemp)
trap 'rm -f "$LIST_FILE"' EXIT

case "$MODE" in
  rhj)
    echo "Fetching RHJ asset list..."
    rwa_fetch_rhj_list "$SCRIPT_DIR" > "$LIST_FILE"
    ;;
  top)
    rwa_top8_list > "$LIST_FILE"
    ;;
  file)
    if [[ -z "${RWA_ALLOWLIST_FILE:-}" || ! -f "$RWA_ALLOWLIST_FILE" ]]; then
      echo "ERROR: RWA_ALLOWLIST=file requires RWA_ALLOWLIST_FILE=/path"
      exit 1
    fi
    grep -v '^#' "$RWA_ALLOWLIST_FILE" > "$LIST_FILE" || true
    ;;
  *)
    echo "ERROR: RWA_ALLOWLIST must be rhj, top, or file"
    exit 1
    ;;
esac

COUNT=$(grep -c ':' "$LIST_FILE" || true)
echo "Tokens to process: $COUNT"

if [[ "${GENERATE_BATCH:-}" == "1" ]]; then
  OUT="$SCRIPT_DIR/allowlist-rwa.batch.sh"
  {
    echo "#!/usr/bin/env bash"
    echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — $COUNT RHJ tokens"
    echo "set -euo pipefail"
    echo "VAULT=\"$VAULT\""
    echo "RPC=\"$RPC\""
    echo "RWA_MAX_POST=\"$RWA_MAX_POST\""
    echo "RWA_DAILY=\"$RWA_DAILY\""
    echo "RWA_WALLET=\"$RWA_WALLET\""
    echo '[[ -n "${OWNER_PRIVATE_KEY:-}" ]] || { echo "export OWNER_PRIVATE_KEY"; exit 1; }'
    echo 'PK="$OWNER_PRIVATE_KEY"; [[ "$PK" == 0x* ]] || PK="0x$PK"'
    while IFS=: read -r sym addr; do
      sym=$(echo "$sym" | tr -d '[:space:]')
      addr=$(echo "$addr" | tr -d '[:space:]')
      [[ -z "$sym" || "$sym" == \#* ]] && continue
      echo "echo 'allowlist $sym'"
      echo "cast send \"\$VAULT\" \"setTokenLimits(address,bool,uint256,uint256,uint256)\" \\"
      echo "  \"$addr\" true \"\$RWA_MAX_POST\" \"\$RWA_DAILY\" \"\$RWA_WALLET\" \\"
      echo "  --private-key \"\$PK\" --rpc-url \"\$RPC\""
    done < "$LIST_FILE"
  } > "$OUT"
  chmod +x "$OUT"
  echo "Wrote $OUT ($COUNT tokens)"
  exit 0
fi

echo "== setTokenLimits =="
rwa_apply_allowlist "$VAULT" "$PK" "$RPC" "${DRY_RUN:-0}" < "$LIST_FILE"

echo ""
echo "Done. Vault holds RHAGENT only until you fund each stock token separately."
echo "Dry-run grants: curl -X POST ... -d '{\"dry_run\":true}' https://rhagent.bot/api/admin/grants"
