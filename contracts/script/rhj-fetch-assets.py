#!/usr/bin/env python3
"""Fetch active Robinhood RHJ stock tokens on Robinhood Chain (4663).

Output: one SYMBOL:0xContract per line, sorted by symbol.
Used by allowlist-rwa-vault.sh and cutover-impact-vault.sh.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

RHJ_ASSETS_URL = os.environ.get("RHJ_ASSETS_URL", "https://api.robinhood.com/rhj/assets")
CHAIN_ID = int(os.environ.get("RH_CHAIN_ID", "4663"))
ISSUER_MARKER = "• Robinhood Token"


def main() -> int:
    try:
        req = urllib.request.Request(RHJ_ASSETS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.load(resp)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        print(f"ERROR: RHJ fetch failed: {e}", file=sys.stderr)
        return 1

    assets = body.get("assets") or []
    rows: list[tuple[str, str]] = []

    for a in assets:
        status = a.get("status")
        if status and status != "ASSET_STATUS_ACTIVE":
            continue
        symbol = (a.get("tokenSymbol") or "").strip().upper()
        if not symbol:
            continue
        name = a.get("tokenName") or ""
        if ISSUER_MARKER not in name:
            continue
        dep = None
        for d in a.get("deployments") or []:
            if d.get("chainId") == CHAIN_ID:
                dep = d
                break
        if not dep:
            continue
        addr = (dep.get("contractAddress") or "").strip()
        if not (len(addr) == 42 and addr.startswith("0x")):
            continue
        rows.append((symbol, addr))

    if not rows:
        print("ERROR: no active RHJ assets on chain", CHAIN_ID, file=sys.stderr)
        return 1

    for symbol, addr in sorted(rows, key=lambda r: r[0]):
        print(f"{symbol}:{addr}")
    print(f"# {len(rows)} active RHJ tokens on chain {CHAIN_ID}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
