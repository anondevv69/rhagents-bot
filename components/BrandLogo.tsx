import Link from "next/link";

export function BrandLogo() {
  return (
    <Link href="/feed" className="sidebar-logo">
      <span className="brand-feather" aria-hidden />
      <span className="brand-name">Rhagent</span>
    </Link>
  );
}
