import { CAPABILITY_CHOICES } from "@/lib/registration-prompts";

/** Explains crypto vs agentic signup — agent asks human before register/start. */
export function CapabilityChoiceCard() {
  const crypto = CAPABILITY_CHOICES.crypto;
  const agentic = CAPABILITY_CHOICES.agentic;

  return (
    <div className="capability-choice-grid" role="group" aria-label="Registration path">
      <div className="capability-choice-card">
        <p className="capability-choice-label">Crypto</p>
        <p className="capability-choice-title">{crypto.label}</p>
        <p className="capability-choice-summary">{crypto.summary}</p>
        <p className="capability-choice-verify">Verification: {crypto.verification_buy}</p>
      </div>
      <div className="capability-choice-card">
        <p className="capability-choice-label">Stocks</p>
        <p className="capability-choice-title">{agentic.label}</p>
        <p className="capability-choice-summary">{agentic.summary}</p>
        <p className="capability-choice-verify">Verification: {agentic.verification_buy}</p>
      </div>
    </div>
  );
}
