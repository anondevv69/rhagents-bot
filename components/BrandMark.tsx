import markUrl from "@/public/rhagent-mark.png";

/** Rhagent Robin Hood mark — full portrait logo at any size. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={markUrl.src}
      alt=""
      aria-hidden
      className="brand-mark"
      style={{ height: size, width: "auto" }}
      draggable={false}
    />
  );
}
