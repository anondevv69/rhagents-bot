"use client";

import { ONBOARDING_GOALS, expandedFromGoal, type OnboardingGoal } from "@/lib/dashboard-onboarding-goals";
import type { UiDefaultSurface } from "@/lib/dashboard-setup-types";

type Props = {
  busy?: boolean;
  onPick: (goal: OnboardingGoal, surface: UiDefaultSurface) => void | Promise<void>;
};

export function DashboardWelcomeGoals({ busy, onPick }: Props) {
  return (
    <div className="trading-dash-welcome">
      <h2 className="owner-settings-heading">What do you want to do?</h2>
      <p className="owner-settings-note muted">
        Pick one to start — you can add the others anytime. Same account, same vault; nothing is locked out later.
      </p>
      <div className="trading-dash-welcome-grid" role="group" aria-label="Setup goals">
        {ONBOARDING_GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="trading-dash-welcome-card"
            disabled={busy}
            onClick={() => {
              void onPick(g.id, g.surface);
            }}
          >
            <strong>{g.title}</strong>
            <span className="owner-settings-note muted">{g.summary}</span>
          </button>
        ))}
      </div>
      <p className="owner-settings-note muted">
        Just browsing the feed with no setup?{" "}
        <a href="/login?mode=viewer" className="text-link">
          Continue as guest
        </a>
        {" "}
        (read-only — no trading dashboard needed).
      </p>
    </div>
  );
}

export { expandedFromGoal };
