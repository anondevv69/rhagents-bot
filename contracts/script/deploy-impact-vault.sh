#!/usr/bin/env bash
# Deploy RhagentImpactVault v2 and print cutover commands.
#
# Required env:
#   OWNER_PRIVATE_KEY   — must control 0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5
#                       (owner of v1 vault + journal). NOT the inscriber key.
#
# Optional env (defaults shown):
#   AUTHORIZER_ADDRESS  — if set, use this as grant authorizer; else generate new key
#   MAX_GRANT_PER_POST  — 50000000000000000000000  (50k RHAGENT)
#   DAILY_TOKEN_BUDGET  — 200000000000000000000000 (200k/day)
#   WALLET_DAILY_CAP    — 60000000000000000000000  (60k/wallet/day)
#   TRADE_REWARD_AMOUNT — 0 (disable trade rewards in v2 until configured)
#   JOURNAL_ADDRESS     — 0x7bbC170871fd9d8294Fedb78080F9152D4B3fbcd
#   V1_VAULT_ADDRESS    — 0x957025B7D3357B88748d35eA28e7Fa455933313D
#   RHAGENT_TOKEN       — 0x894fAc757250F8E02180E1856957274D84AC4bA3
#   FUND_AMOUNT         — 96000000000000000000000 (96k RHAGENT wei)

set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
JOURNAL="${JOURNAL_ADDRESS:-0x7bbC170871fd9d8294Fedb78080F9152D4B3fbcd}"
V1_VAULT="${V1_VAULT_ADDRESS:-0x957025B7D3357B88748d35eA28e7Fa455933313D}"
RHAGENT="${RHAGENT_TOKEN:-0x894fAc757250F8E02180E1856957274D84AC4bA3}"
MAX_GRANT="${MAX_GRANT_PER_POST:-50000000000000000000000}"
DAILY_BUDGET="${DAILY_TOKEN_BUDGET:-200000000000000000000000}"
WALLET_CAP="${WALLET_DAILY_CAP:-60000000000000000000000}"
TRADE_REWARD="${TRADE_REWARD_AMOUNT:-0}"
EXPECTED_OWNER="0x5bBdb0Eb9cEF211FE92FD0A38318d66b65d254f5"

if [[ -z "${OWNER_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: Set OWNER_PRIVATE_KEY (vault/journal owner — NOT RHAGENT_INSCRIBER_PRIVATE_KEY)."
  echo "       Expected owner address: $EXPECTED_OWNER"
  exit 1
fi

PK="$OWNER_PRIVATE_KEY"
[[ "$PK" == 0x* ]] || PK="0x$PK"

DEPLOYER=$(cast wallet address --private-key "$PK")
echo "Deployer/owner: $DEPLOYER"
if [[ "${DEPLOYER,,}" != "${EXPECTED_OWNER,,}" ]]; then
  echo "WARNING: Deployer is not the documented journal/v1 owner ($EXPECTED_OWNER)."
  echo "         Cutover steps 3–4 will fail unless this wallet owns those contracts."
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans:-}" == [yY] ]] || exit 1
fi

# ── Authorizer key (backend signs payGrant txs) ───────────────────────────────
AUTH_KEY_FILE="${AUTH_KEY_FILE:-../.secrets/grant-authorizer.key}"
mkdir -p "$(dirname "$AUTH_KEY_FILE")"

if [[ -n "${AUTHORIZER_ADDRESS:-}" ]]; then
  AUTHORIZER="$AUTHORIZER_ADDRESS"
  echo "Using existing authorizer address: $AUTHORIZER"
  if [[ -z "${RHAGENT_GRANT_AUTHORIZER_KEY:-}" ]]; then
    echo "ERROR: AUTHORIZER_ADDRESS set but RHAGENT_GRANT_AUTHORIZER_KEY missing."
    exit 1
  fi
else
  if [[ -f "$AUTH_KEY_FILE" ]]; then
    AUTH_PK=$(cat "$AUTH_KEY_FILE")
    echo "Reusing authorizer key from $AUTH_KEY_FILE"
  else
    echo "Generating new grant authorizer wallet..."
    AUTH_PK=$(cast wallet new --json | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['private_key'])")
    echo "$AUTH_PK" > "$AUTH_KEY_FILE"
    chmod 600 "$AUTH_KEY_FILE"
    echo "Saved authorizer private key → $AUTH_KEY_FILE (chmod 600, never commit)"
  fi
  [[ "$AUTH_PK" == 0x* ]] || AUTH_PK="0x$AUTH_PK"
  AUTHORIZER=$(cast wallet address --private-key "$AUTH_PK")
  echo "Authorizer address: $AUTHORIZER"
fi

# Fund authorizer with gas if empty
AUTH_ETH=$(cast balance "$AUTHORIZER" --rpc-url "$RPC" 2>/dev/null || echo 0)
if [[ "$AUTH_ETH" == "0" ]]; then
  echo "Funding authorizer with 0.002 ETH for gas..."
  cast send "$AUTHORIZER" --value 0.002ether --private-key "$PK" --rpc-url "$RPC"
fi

echo "Building contract..."
forge build

echo "Deploying RhagentImpactVault v2..."
DEPLOY_OUT=$(forge create src/RhagentImpactVault.sol:RhagentImpactVault \
  --rpc-url "$RPC" \
  --private-key "$PK" \
  --constructor-args "$AUTHORIZER" "0x0000000000000000000000000000000000000000" \
    "$MAX_GRANT" "$DAILY_BUDGET" "$WALLET_CAP" "$TRADE_REWARD" \
  --json)
V2=$(echo "$DEPLOY_OUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['deployedTo'])")
echo "RhagentImpactVault v2: $V2"

echo "Linking journal contract on v2..."
cast send "$V2" "setJournalContract(address)" "$JOURNAL" --private-key "$PK" --rpc-url "$RPC"

FUND="${FUND_AMOUNT:-96000000000000000000000}"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "MANUAL CUTOVER (run in order, owner key required):"
echo ""
echo "1. Withdraw from v1 vault → owner wallet:"
echo "   cast send $V1_VAULT \"withdraw(address,uint256)\" $DEPLOYER $FUND \\"
echo "     --private-key \$OWNER_PRIVATE_KEY --rpc-url $RPC"
echo ""
echo "2. Transfer RHAGENT to v2:"
echo "   cast send $RHAGENT \"transfer(address,uint256)\" $V2 $FUND \\"
echo "     --private-key \$OWNER_PRIVATE_KEY --rpc-url $RPC"
echo ""
echo "3. Point journal at v2 (after v2 is funded):"
echo "   cast send $JOURNAL \"setRewardVault(address)\" $V2 \\"
echo "     --private-key \$OWNER_PRIVATE_KEY --rpc-url $RPC"
echo ""
echo "4. Railway env (dry-run first):"
echo "   railway variables set RHAGENT_IMPACT_VAULT_ADDRESS=$V2 --service rhagentsite"
echo "   railway variables set RHAGENT_GRANT_AUTHORIZER_KEY=<from $AUTH_KEY_FILE> --service rhagentsite"
echo "   railway variables set RHAGENT_GRANTS_ENABLED=false --service rhagentsite"
echo ""
echo "5. Dry-run grants:"
echo "   curl -H \"x-admin-secret: \$ADMIN_SECRET\" https://rhagent.bot/api/admin/grants"
echo "   curl -X POST -H \"x-admin-secret: \$ADMIN_SECRET\" -H 'content-type: application/json' \\"
echo "        -d '{\"dry_run\":true}' https://rhagent.bot/api/admin/grants"
echo ""
echo "6. Enable live payouts only after dry-run looks right:"
echo "   railway variables set RHAGENT_GRANTS_ENABLED=true --service rhagentsite"
echo "   railway redeploy -y --service rhagentsite"
echo "══════════════════════════════════════════════════════════════════"

# Write deploy record (addresses only — key stays in .secrets/)
RECORD="../.secrets/impact-vault-deploy.json"
mkdir -p "$(dirname "$RECORD")"
python3 - <<PY
import json, os
from datetime import datetime, timezone
rec = {
  "deployed_at": datetime.now(timezone.utc).isoformat(),
  "v2_address": "$V2",
  "authorizer": "$AUTHORIZER",
  "v1_vault": "$V1_VAULT",
  "journal": "$JOURNAL",
  "owner": "$DEPLOYER",
  "limits": {
    "max_grant_per_post": "$MAX_GRANT",
    "daily_token_budget": "$DAILY_BUDGET",
    "wallet_daily_cap": "$WALLET_CAP",
    "trade_reward": "$TRADE_REWARD",
  },
}
with open("$RECORD", "w") as f:
    json.dump(rec, f, indent=2)
print(f"Wrote {rec['v2_address']} → $RECORD")
PY
