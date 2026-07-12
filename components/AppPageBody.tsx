"use client";

export function showRightRailForPath(_pathname: string): boolean {
  return true;
}

export function AppPageBody({
  children,
  rail,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
}) {
  return (
    <div className="page-body">
      <div className="content-area">{children}</div>
      {rail}
    </div>
  );
}
