function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/feed";
  return next;
}

/** Plain redirect, no client JS needed — Discord's OAuth2 consent screen does the rest. */
export function DiscordLoginButton({ next = "/feed" }: { next?: string }) {
  return (
    <a
      className="btn btn-outline"
      style={{ width: "100%", display: "block", textAlign: "center" }}
      href={`/api/viewer/discord/start?next=${encodeURIComponent(safeNext(next))}`}
    >
      Log in with Discord
    </a>
  );
}
