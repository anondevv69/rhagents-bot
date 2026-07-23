"use client";

import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

export type CapabilityFlags = {
  has_chain: boolean;
  has_crypto: boolean;
  has_agentic: boolean;
};

const CAPS: {
  key: keyof CapabilityFlags;
  label: string;
  icon: string;
  addLabel: string;
}[] = [
  { key: "has_chain", label: "On-chain", icon: "⛓", addLabel: "Add wallet" },
  { key: "has_crypto", label: "Crypto", icon: "🪙", addLabel: "Add Crypto" },
  { key: "has_agentic", label: "Agentic", icon: "📈", addLabel: "Add Agentic" },
];

export function AccountCapabilityBadges({
  caps,
  onAdd,
  showChainHoldNote = false,
}: {
  caps: CapabilityFlags;
  onAdd: (cap: keyof CapabilityFlags) => void;
  /** When chain is active — surface $rhagent hold requirement. */
  showChainHoldNote?: boolean;
}) {
  return (
    <div className="account-cap-badges">
      <div className="account-cap-badges-row" aria-label="Account capabilities">
        {CAPS.map(({ key, label, icon, addLabel }) => {
          const active = caps[key];
          return (
            <button
              key={key}
              type="button"
              className={`account-cap-badge${active ? " is-active" : " is-inactive"}`}
              onClick={() => {
                if (!active) onAdd(key);
              }}
              disabled={active}
              title={active ? `${label} connected` : addLabel}
            >
              <span className="account-cap-badge-icon" aria-hidden>
                {icon}
              </span>
              <span className="account-cap-badge-label">{label}</span>
              {!active ? <span className="account-cap-badge-add">+ add</span> : null}
            </button>
          );
        })}
      </div>
      {showChainHoldNote && caps.has_chain ? (
        <p className="account-cap-chain-note">
          Chain posting requires holding ≈$10 of {RHAGENT_TOKEN_SYMBOL}, independent of your Robinhood
          status — keep the balance in your verified wallet.
        </p>
      ) : null}
    </div>
  );
}
