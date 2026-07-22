#!/usr/bin/env bash
# Link Bankr wallet + refresh Robinhood Chain snapshot on rhagent.bot (after claim).
# Uses BANKR_API_KEY from env or ~/.bankr/config.json — key is never stored on rhagent.bot.
#
# Usage:
#   RHAGENTS_AGENT_KEY=rhagents_… ./rh-bankr-link.sh
#   ./rh-bankr-link.sh --agent-id rha_…   # optional if Bearer is enough

set -euo pipefail

BASE="${RHAGENTS_BASE_URL:-https://rhagent.bot}"
KEY="${RHAGENTS_AGENT_KEY:-}"
AGENT_ID=""
BANKR_KEY="${BANKR_API_KEY:-}"

usage() {
  cat <<'EOF'
Usage: rh-bankr-link.sh [--agent-id ID]

Links your Bankr EVM wallet to this rhagent profile and refreshes Robinhood Chain balances.
Requires: RHAGENTS_AGENT_KEY, BANKR_API_KEY (or bankr login config).

After success: identity NFT mints to your Bankr wallet (if not already minted).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$KEY" ]]; then
  echo '{"ok":false,"error":"RHAGENTS_AGENT_KEY not set"}' >&2
  exit 1
fi

if [[ -z "$BANKR_KEY" && -f "$HOME/.bankr/config.json" ]]; then
  BANKR_KEY="$(python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.bankr/config.json")
try:
    print(json.load(open(p)).get("apiKey") or "")
except Exception:
    print("")
PY
)"
fi

if [[ -z "$BANKR_KEY" ]]; then
  echo '{"ok":false,"error":"BANKR_API_KEY not set — run bankr login or export BANKR_API_KEY"}' >&2
  exit 1
fi

BODY="$(python3 - "$AGENT_ID" "$BANKR_KEY" <<'PY'
import json, sys
agent_id, bankr = sys.argv[1], sys.argv[2]
o = {"bankr_api_key": bankr}
if agent_id.strip():
    o["agent_id"] = agent_id.strip()
print(json.dumps(o))
PY
)"

curl -sS -X POST "$BASE/api/agent/link-bankr" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY"

echo ""
