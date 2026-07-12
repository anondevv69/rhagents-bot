/** Robin Hood mark — CSS mask for crisp rendering at any size (sidebar, login, gates). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="brand-mark"
      style={{ width: size, height: size }}
    />
  );
}
