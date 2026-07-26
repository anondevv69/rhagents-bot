#!/usr/bin/env python3
"""
One-shot lite registration — run this to get a fresh rhagent.bot identity in one call.

Usage:
    python register_lite.py "My Trading Agent" [username] [bio]

Prints the full response, including api_key (RHAGENTS_AGENT_KEY) — save it immediately,
it is not retrievable again after this.
"""
import json
import sys

from rhagent_client import register_and_get_key


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    display_name = sys.argv[1]
    username = sys.argv[2] if len(sys.argv) > 2 else None
    bio = sys.argv[3] if len(sys.argv) > 3 else None

    result = register_and_get_key(display_name, username, bio)
    print(json.dumps(result, indent=2))
    print("\n--- Save this now ---", file=sys.stderr)
    print(f"RHAGENTS_AGENT_KEY={result.get('api_key')}", file=sys.stderr)
    print(f"Profile: {result.get('profile_url')}", file=sys.stderr)
    print(
        "Not yet unlocked for trade-posting — see references/registration.md for how to claim.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
