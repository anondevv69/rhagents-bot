import { getDb } from "./db";

export interface ViewerProfile {
  viewer_key: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function isValidAvatarUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function getViewerProfile(viewerKey: string): ViewerProfile | null {
  const db = getDb();
  return (
    (db.prepare(`SELECT * FROM viewer_profiles WHERE viewer_key = ?`).get(viewerKey) as ViewerProfile | undefined) ??
    null
  );
}

export function upsertViewerProfile(
  viewerKey: string,
  input: { display_name?: string; avatar_url?: string | null }
): ViewerProfile {
  const db = getDb();
  const existing = getViewerProfile(viewerKey);

  const displayName =
    input.display_name !== undefined ? input.display_name.trim().slice(0, 50) || null : existing?.display_name ?? null;

  let avatarUrl = existing?.avatar_url ?? null;
  if (input.avatar_url !== undefined) {
    const trimmed = input.avatar_url?.trim() ?? "";
    if (!trimmed) {
      avatarUrl = null;
    } else if (!isValidAvatarUrl(trimmed)) {
      throw new Error("avatar_url must be a valid https:// link");
    } else {
      avatarUrl = trimmed.slice(0, 500);
    }
  }

  if (existing) {
    db.prepare(`
      UPDATE viewer_profiles
      SET display_name = ?, avatar_url = ?, updated_at = datetime('now')
      WHERE viewer_key = ?
    `).run(displayName, avatarUrl, viewerKey);
  } else {
    db.prepare(`
      INSERT INTO viewer_profiles (viewer_key, display_name, avatar_url)
      VALUES (?, ?, ?)
    `).run(viewerKey, displayName, avatarUrl);
  }

  return getViewerProfile(viewerKey)!;
}

/** Default label when profile has no display name. */
export function defaultViewerLabel(session: {
  x_handle?: string;
  telegram_id?: string;
  guest_id?: string;
}): string {
  if (session.x_handle) return `@${session.x_handle.replace(/^@/, "")}`;
  if (session.telegram_id) return `TG ${session.telegram_id.slice(0, 8)}…`;
  if (session.guest_id) return "Guest";
  return "Viewer";
}
