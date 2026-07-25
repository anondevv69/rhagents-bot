"use client";

import { useState } from "react";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "rhagent";

type UserType = "trader" | "agent" | "copier" | "partner";

interface Step {
  id: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: "type", title: "How will you use " + brand + "?", description: "Pick your path — you can change this later." },
  { id: "wallet", title: "Wallet Setup", description: "Your wallet is auto-provisioned. Nothing to do here." },
  { id: "connect", title: "Connect Accounts", description: "Optional — connect when you're ready to trade." },
  { id: "done", title: "You're all set", description: "Start using " + brand + " in Telegram or the dashboard." },
];

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const next = () => {
    if (currentStep === 0 && !userType) return;
    if (currentStep === 1 && !walletAddress) {
      // Simulate wallet provisioning
      setIsProvisioning(true);
      setTimeout(() => {
        setWalletAddress("0x3e1334a5b...28d4f1");
        setIsProvisioning(false);
        setCurrentStep((s) => s + 1);
      }, 2000);
      return;
    }
    if (!isLast) setCurrentStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1 flex-1 rounded-full transition-all"
              style={{
                background: i <= currentStep ? "var(--brand-accent)" : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="card p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{step.title}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {step.description}
            </p>
          </div>

          {/* Step 1: User type selection */}
          {currentStep === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                selected={userType === "trader"}
                title="Trader"
                desc="Trade crypto through Robinhood with AI assistance"
                onClick={() => setUserType("trader")}
              />
              <TypeCard
                selected={userType === "agent"}
                title="AI Agent User"
                desc="Use AI for research, memory, skills, and more"
                onClick={() => setUserType("agent")}
              />
              <TypeCard
                selected={userType === "copier"}
                title="Copy Trader"
                desc="Follow and copy trades from top performers"
                onClick={() => setUserType("copier")}
              />
              <TypeCard
                selected={userType === "partner"}
                title="Partner"
                desc="White-label the platform for your community"
                onClick={() => setUserType("partner")}
              />
            </div>
          )}

          {/* Step 2: Wallet provisioning */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {isProvisioning ? (
                <div className="text-center py-8">
                  <div
                    className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--brand-accent)" }}
                  />
                  <p style={{ color: "var(--text-secondary)" }}>Provisioning your wallet...</p>
                </div>
              ) : walletAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ background: "var(--success)", color: "#000" }}
                    >
                      ✓
                    </span>
                    <span>Wallet created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ background: "var(--success)", color: "#000" }}
                    >
                      ✓
                    </span>
                    <span>$5 starter credit loaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ background: "var(--success)", color: "#000" }}
                    >
                      ✓
                    </span>
                    <span>25 free messages activated</span>
                  </div>
                  <p className="text-xs font-mono pt-2" style={{ color: "var(--text-muted)" }}>
                    {walletAddress}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p>We'll create a wallet for you automatically. This includes:</p>
                  <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <li>• An EVM wallet on Robinhood Chain & Base</li>
                    <li>• $5 in LLM credits for AI chat</li>
                    <li>• 25 free starter messages</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Connect accounts */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <ConnectOption
                name="Robinhood Crypto"
                desc="Required for trading"
                recommended={userType === "trader" || userType === "copier"}
              />
              <ConnectOption
                name="Robinhood Agentic"
                desc="AI-powered trading features"
                recommended={userType === "agent"}
              />
              <ConnectOption
                name={`${brand}.bot`}
                desc="Post & copy trades on the feed"
                recommended={userType === "copier"}
              />
              <p className="text-xs pt-2" style={{ color: "var(--text-muted)" }}>
                All connections are optional. You can add them anytime from Settings.
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {currentStep === 3 && (
            <div className="space-y-4 text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto"
                style={{ background: "var(--brand-accent)", color: "#000" }}
              >
                ✓
              </div>
              <p>Your account is ready. Here's where to go next:</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <a
                  href={`https://t.me/${brand}_bot`}
                  className="btn btn-primary py-3"
                >
                  Open Telegram
                </a>
                <a href="/dashboard" className="btn btn-secondary py-3">
                  Dashboard
                </a>
              </div>
            </div>
          )}

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex justify-between pt-4">
              {currentStep > 0 ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentStep((s) => s - 1)}
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <button
                className="btn btn-primary"
                onClick={next}
                disabled={currentStep === 0 && !userType}
                style={{ opacity: currentStep === 0 && !userType ? 0.5 : 1 }}
              >
                {currentStep === 1 && !walletAddress ? "Create Wallet" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeCard({
  selected,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card card-hover text-left"
      style={{
        borderColor: selected ? "var(--brand-accent)" : undefined,
        background: selected ? "rgba(34,197,94,0.05)" : undefined,
      }}
    >
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        {desc}
      </p>
    </button>
  );
}

function ConnectOption({
  name,
  desc,
  recommended,
}: {
  name: string;
  desc: string;
  recommended?: boolean;
}) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">
          {name}
          {recommended && (
            <span className="badge badge-success ml-2 text-xs">Recommended</span>
          )}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {desc}
        </p>
      </div>
      <button className="btn btn-secondary text-xs">Connect</button>
    </div>
  );
}
