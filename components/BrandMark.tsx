/** Robin Hood mark — sidebar, login, gate pages. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/rhagent-logo.png"
      alt=""
      aria-hidden
      className="brand-mark"
      width={size}
      height={size}
    />
  );
}
