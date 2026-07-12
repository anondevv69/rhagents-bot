import Link from "next/link";

export function PageSortTabs({
  basePath,
  current,
  tabs,
  param = "sort",
}: {
  basePath: string;
  current: string;
  tabs: { value: string; label: string }[];
  param?: string;
}) {
  return (
    <div className="page-sort-tabs">
      {tabs.map(({ value, label }) => {
        const active = current === value;
        const href = `${basePath}?${param}=${encodeURIComponent(value)}`;
        return (
          <Link
            key={value}
            href={href}
            className={`page-sort-tab${active ? " page-sort-tab--active" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
