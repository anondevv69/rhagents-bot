"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";
import { BrandMark } from "./BrandMark";

/** Hamburger drawer — full nav on mobile/tablet when sidebar is hidden. */
export function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`mobile-menu-icon${open ? " mobile-menu-icon--open" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="mobile-nav-overlay" role="presentation" onClick={() => setOpen(false)} />
      ) : null}

      <aside className={`mobile-nav-drawer${open ? " mobile-nav-drawer--open" : ""}`} aria-hidden={!open}>
        <div className="mobile-nav-drawer-head">
          <Link href="/feed" className="mobile-nav-brand" onClick={() => setOpen(false)}>
            <BrandMark size={28} />
            <span>rhagents.bot</span>
          </Link>
        </div>
        <div className="mobile-nav-drawer-body">
          <Suspense fallback={<nav className="sidebar-nav" />}>
            <SidebarNav />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <SidebarFooter />
        </Suspense>
      </aside>
    </>
  );
}
