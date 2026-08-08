#!/usr/bin/env bash
# Shared RWA vault allowlist helpers (bash 3.2 safe).
# Sourced by cutover-impact-vault.sh and allowlist-rwa-vault.sh — do not execute directly.

rwa_allowlist_defaults() {
  # Caps in token units (18 decimals). Conservative — allowlist only until vault is funded per asset.
  RWA_MAX_POST="${RWA_MAX_POST:-1000000000000000}"       # 0.001 shares/post
  RWA_DAILY="${RWA_DAILY:-10000000000000000}"          # 0.01 shares/day vault-wide
  RWA_WALLET="${RWA_WALLET:-1000000000000000}"         # 0.001 shares/wallet/day
  RWA_SKIP_ALREADY="${RWA_SKIP_ALREADY:-1}"
}

rwa_fetch_rhj_list() {
  local script_dir="$1"
  python3 "$script_dir/rhj-fetch-assets.py"
}

rwa_top8_list() {
  cat <<'RWA_TOP8_EOF'
NVDA:0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC
SPY:0x117cc2133c37B721F49dE2A7a74833232B3B4C0C
AAPL:0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9
TSLA:0x322F0929c4625eD5bAd873c95208D54E1c003b2d
QQQ:0xD5f3879160bc7c32ebb4dC785F8a4F505888de68
META:0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35
MSTR:0xec262a75e413fAfD0dF80480274532C79D42da09
COIN:0x6330D8C3178a418788dF01a47479c0ce7CCF450b
RWA_TOP8_EOF
}

# Apply setTokenLimits for each SYMBOL:ADDR line on stdin.
# Requires: VAULT, PK, RPC
rwa_apply_allowlist() {
  local vault="$1"
  local pk="$2"
  local rpc="$3"
  local dry_run="${4:-0}"
  local sent=0 skipped=0 failed=0

  rwa_allowlist_defaults

  while IFS=: read -r sym addr; do
    sym=$(echo "$sym" | tr -d '[:space:]')
    addr=$(echo "$addr" | tr -d '[:space:]')
    [[ -z "$sym" || "$sym" == \#* ]] && continue
    [[ -z "$addr" ]] && continue

    if [[ "$RWA_SKIP_ALREADY" == "1" ]]; then
      local already
      already=$(cast call "$vault" "isTokenAllowed(address)(bool)" "$addr" --rpc-url "$rpc" 2>/dev/null | awk '{print $1}') || already=""
      if [[ "$already" == "true" ]]; then
        echo "  skip $sym (already allowed)"
        skipped=$((skipped + 1))
        continue
      fi
    fi

    echo "  allowlist $sym @ $addr"
    if [[ "$dry_run" == "1" ]]; then
      echo "cast send \"$vault\" \"setTokenLimits(address,bool,uint256,uint256,uint256)\" \\"
      echo "  \"$addr\" true \"$RWA_MAX_POST\" \"$RWA_DAILY\" \"$RWA_WALLET\" \\"
      echo "  --private-key \"\$OWNER_PRIVATE_KEY\" --rpc-url \"$rpc\""
      sent=$((sent + 1))
      continue
    fi

    if cast send "$vault" "setTokenLimits(address,bool,uint256,uint256,uint256)" \
      "$addr" true "$RWA_MAX_POST" "$RWA_DAILY" "$RWA_WALLET" \
      --private-key "$pk" --rpc-url "$rpc"; then
      sent=$((sent + 1))
    else
      echo "  ERROR: failed $sym" >&2
      failed=$((failed + 1))
    fi
  done

  echo "allowlist summary: sent=$sent skipped=$skipped failed=$failed"
  [[ "$failed" -eq 0 ]]
}
