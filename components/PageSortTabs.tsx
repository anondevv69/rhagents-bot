import Link from "next/link";

export function PageSortTabs({
  basePath,
  current,
  tabs,
  param = "sort",
  preserve,
  className,
}: {
  basePath: string;
  current: string;
  tabs: { value: string; label: string }[];
  param?: string;
  preserve?: Record<string, string>;
  className?: string;
}) {
  return (
    <div className={`atlas-tabbar${className ? ` ${className}` : ""}`}>
      {tabs.map(({ value, label }) => {
        const active = current === value;
        const qs = new URLSearchParams(preserve ?? {});
        qs.set(param, value);
        const href = `${basePath}?${qs.toString()}`;
        return (
          <Link key={value} href={href} className={`atlas-tab${active ? " is-active" : ""}`}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
