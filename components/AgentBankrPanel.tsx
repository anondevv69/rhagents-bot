import type { BankrProfileView } from "@/lib/bankr-profile";

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function AgentBankrPanel({ bankr }: { bankr: BankrProfileView }) {
  if (!bankr.managed && !bankr.capabilities.agentic && !bankr.capabilities.crypto) {
    return null;
  }

  return (
    <div className="panel agent-bankr-panel">
      <div className="panel-header-row">
        <div className="panel-label">Bankr wallet</div>
        {bankr.managed ? <span className="badge badge-verified">Bankr-managed</span> : null}
      </div>

      {bankr.managed ? (
        <>
          <p className="owner-settings-note" style={{ marginBottom: 8 }}>
            <code className="docs-code-inline">{bankr.walletShort}</code>
            {bankr.chainTotalUsd != null ? (
              <span> · Robinhood Chain {fmtUsd(bankr.chainTotalUsd)}</span>
            ) : null}
          </p>
          {(bankr.ethBalance || bankr.rhagentTokens != null) && (
            <p className="owner-settings-note muted" style={{ marginBottom: 8 }}>
              {bankr.ethBalance ? `${parseFloat(bankr.ethBalance).toFixed(4)} ETH` : null}
              {bankr.ethBalance && bankr.rhagentTokens != null ? " · " : null}
              {bankr.rhagentTokens != null && bankr.rhagentTokens > 0
                ? `${bankr.rhagentTokens.toLocaleString()} RHAGENT${bankr.rhagentValueUsd != null ? ` (${fmtUsd(bankr.rhagentValueUsd)})` : ""}`
                : null}
            </p>
          )}
          {bankr.topTokens.length > 0 ? (
            <ul className="agent-bankr-tokens">
              {bankr.topTokens.map((t) => (
                <li key={`${t.symbol}-${t.balance ?? t.usd}`}>
                  <span>{t.symbol}</span>
                  {t.usd > 0 ? <span>{fmtUsd(t.usd)}</span> : null}
                  {t.balance ? <span className="muted">{t.balance}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty" style={{ padding: "8px 0" }}>
              No Robinhood Chain tokens yet — link refreshes after your next Bankr swap.
            </p>
          )}
          {bankr.snapshotAt ? (
            <p className="panel-footnote">Balances updated {new Date(bankr.snapshotAt).toLocaleString()}</p>
          ) : null}
        </>
      ) : (
        <p className="panel-empty" style={{ padding: "8px 0" }}>
          Bankr wallet not linked on this profile — run <code className="docs-code-inline">rh-bankr-link.sh</code>{" "}
          after claim.
        </p>
      )}

      <div className="agent-bankr-caps">
        <span className={`agent-bankr-cap${bankr.capabilities.agentic ? " is-on" : ""}`}>
          Agentic{bankr.capabilities.agenticInBankr ? " · Bankr env" : ""}
        </span>
        <span className={`agent-bankr-cap${bankr.capabilities.crypto ? " is-on" : ""}`}>
          Crypto{bankr.capabilities.cryptoInBankr ? " · Bankr env" : ""}
        </span>
        <span className={`agent-bankr-cap${bankr.capabilities.chain ? " is-on" : ""}`}>Chain</span>
      </div>

      {bankr.envKeys.length > 0 ? (
        <p className="panel-footnote" style={{ marginTop: 8 }}>
          Bankr env: {bankr.envKeys.slice(0, 8).join(", ")}
          {bankr.envKeys.length > 8 ? " …" : ""}
        </p>
      ) : null}

      {bankr.nftExplorer ? (
        <p className="panel-footnote" style={{ marginTop: 8 }}>
          <a href={bankr.nftExplorer} className="text-link" target="_blank" rel="noreferrer">
            Identity NFT on Robinhood Chain
          </a>
        </p>
      ) : bankr.managed && !bankr.nftMinted ? (
        <p className="panel-footnote" style={{ marginTop: 8 }}>
          Identity NFT pending — owner can mint from agent settings after linking.
        </p>
      ) : null}
    </div>
  );
}
