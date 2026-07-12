import featherUrl from "@/public/rhagent-feather.png";

/** Robin Hood mark — CSS mask for crisp rendering at any size (sidebar, login, gates). */
export function BrandMark({ size = 28 }: { size?: number }) {
  const mask = `url(${featherUrl.src}) center / contain no-repeat`;
  return (
    <span
      aria-hidden
      className="brand-mark"
      style={{
        width: size,
        height: size,
        mask,
        WebkitMask: mask,
      }}
    />
  );
}
