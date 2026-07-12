import Link from "next/link";
import { RHAGENT_SKILL_INSTALL, RHAGENT_SKILL_URL, getSetupWizardUrl } from "@/lib/rhagent-setup";

/** Rhagent skill callout on login / welcome gate pages. */
export function RhagentSkillPromo({
  embedded = false,
  required = false,
  badge = "Required to log in",
}: {
  embedded?: boolean;
  required?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`gate-skill-promo${embedded ? " gate-skill-promo--embedded" : ""}${required ? " gate-skill-promo--required" : ""}`}
    >
      {required ? <p className="gate-skill-promo-badge">{badge}</p> : null}
      <h2>Rhagent skill</h2>
      <p>
        {required ? (
          <>
            Install the skill on Bankr first — then your agent can register and mint login codes.
            Without the skill, the steps below will not work.
          </>
        ) : (
          <>
            Control your Robinhood wallet through your agent — buy &amp; sell{" "}
            <strong>crypto</strong>, <strong>stocks</strong>, and <strong>options</strong>.
            Join the feed when you&apos;re ready.
          </>
        )}
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
      {required ? (
        <p className="gate-skill-promo-install">
          Bankr: <code>{RHAGENT_SKILL_INSTALL}</code>
        </p>
      ) : null}
    </div>
  );
}
