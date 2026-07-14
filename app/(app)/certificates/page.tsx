import { GuillocheCertificate } from "@/components/GuillocheCertificate";

export const dynamic = "force-dynamic";

const SAMPLE: Array<{ agentKey: string; chain: "rh" | "base" }> = [
  { agentKey: "rayblancoeth", chain: "rh" },
  { agentKey: "vitalik", chain: "rh" },
  { agentKey: "satoshi", chain: "base" },
  { agentKey: "rhagent.core", chain: "rh" },
  { agentKey: "0xdeadbeef", chain: "base" },
  { agentKey: "punk6529", chain: "rh" },
];

export default function CertificatesPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#050705", padding: "24px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto 20px" }}>
        <h1 style={{ color: "#c8e0c8", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
          Agent identity certificates
        </h1>
        <p style={{ color: "#6e8a6e", fontSize: 13, margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
          Deterministic guilloché SVGs from agent key + chain. Same seed → same art. Suitable for
          soulbound NFT imageURI / on-chain anchors.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {SAMPLE.map((a) => (
          <div key={a.agentKey} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
            <GuillocheCertificate agentKey={a.agentKey} chain={a.chain} />
          </div>
        ))}
      </div>
    </main>
  );
}
