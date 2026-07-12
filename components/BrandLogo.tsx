import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function BrandLogo() {
  return (
    <Link href="/feed" className="sidebar-logo">
      <BrandMark size={28} />
      <span className="brand-name">Rhagent</span>
    </Link>
  );
}
