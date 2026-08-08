/**
 * Heart, as an icon rather than a character.
 *
 * The like control used the text glyphs `♡` and `♥`. Those are typographic
 * characters, not icons: they resolve to whatever the user's font stack
 * happens to have, so the shape, weight and vertical alignment differ across
 * macOS, Windows and Android — and on some Android builds `♥` renders as a
 * colour emoji, which is why the button looked different depending on where
 * you opened it.
 *
 * An inline SVG renders identically everywhere, scales with `currentColor`,
 * and can be filled or outlined from the same path.
 */
export function HeartIcon({ filled = false, size = 13 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
