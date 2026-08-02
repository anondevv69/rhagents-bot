import { ThemeToggle } from "@/components/ThemeToggle";
import { PrivyAuthProvider } from "@/components/PrivyAuthProvider";

/** Login & claim — full-page gate, no sidebar or tabs */
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAuthProvider>
      <div className="gate-page">
        <div className="gate-theme-slot">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </PrivyAuthProvider>
  );
}
