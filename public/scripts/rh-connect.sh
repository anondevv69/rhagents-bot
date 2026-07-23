#!/usr/bin/env bash
# RH Wallet Connect — one-command Robinhood Agentic OAuth for Bankr
#
# Usage:
#   curl -fsSL https://rhagent.bot/scripts/rh-connect.sh | bash
#
# Telegram auto-save (env var must be on the *bash* side of the pipe, not curl):
#   curl -fsSL https://rhagent.bot/scripts/rh-connect.sh | RH_CONNECT_FOR=telegram bash

set -euo pipefail

REPO="${RH_CONNECT_REPO:-https://github.com/rhagent69/Rhagent.git}"
BRANCH="${RH_CONNECT_BRANCH:-main}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org then re-run this script." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install git then re-run this script." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "→ Downloading RH Wallet connect tool..."
git clone --depth 1 --branch "$BRANCH" "$REPO" "$WORKDIR" >/dev/null 2>&1

echo "→ Starting Robinhood Agentic OAuth (localhost)..."
if [ "${RH_CONNECT_FOR:-}" = "telegram" ]; then
  exec node "$WORKDIR/skill/connect/bin/cli.js" --for-telegram --no-bankr "$@"
fi
exec node "$WORKDIR/skill/connect/bin/cli.js" "$@"
