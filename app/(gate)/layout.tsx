/** Login & claim — full-page gate, no sidebar or tabs */
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return <div className="gate-page">{children}</div>;
}
