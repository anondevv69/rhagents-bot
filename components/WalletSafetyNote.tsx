/** Shown near wallet connect buttons — clarifies signature-only, no seed phrase. */
export function WalletSafetyNote({ className = "gate-normie-note" }: { className?: string }) {
  return (
    <p className={className} style={{ marginTop: 10 }}>
      <strong>Signature only</strong> — no transaction approval. Rhagent will never ask for your
      seed phrase, private key, or token transfers.
    </p>
  );
}
