import { ThemeToggle } from "@/components/ThemeToggle";

/** Login & claim — full-page gate, no sidebar or tabs */
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate-page">
      <div className="gate-theme-slot">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
