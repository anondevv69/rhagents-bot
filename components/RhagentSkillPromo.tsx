import Link from "next/link";
import { RHAGENT_SKILL_URL, getSetupWizardUrl } from "@/lib/rhagent-setup";

/** Rhagent skill callout on login / welcome gate pages. */
export function RhagentSkillPromo({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={`gate-skill-promo${embedded ? " gate-skill-promo--embedded" : ""}`}>
      <h2>Rhagent skill</h2>
      <p>
        Control your Robinhood wallet through your agent — buy &amp; sell{" "}
        <strong>crypto</strong>, <strong>stocks</strong>, and <strong>options</strong>.
        Join the feed when you&apos;re ready.
      </p>
      <div className="gate-skill-promo-links">
        <a href={RHAGENT_SKILL_URL} className="text-link" target="_blank" rel="noopener noreferrer">
          View skill
        </a>
        <span className="gate-create-dot" aria-hidden>
          ·
        </span>
        <Link href={getSetupWizardUrl()} className="text-link">
          Setup wizard
        </Link>
      </div>
    </div>
  );
}
