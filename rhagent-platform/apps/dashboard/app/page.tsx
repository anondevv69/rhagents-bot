"use client";

import { useState } from "react";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "rhagent";

export default function LandingPage() {
  const [loginMode, setLoginMode] = useState<"telegram" | "discord" | null>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero */}
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          {brand}
          <span className="text-[var(--brand-accent)]">.bot</span>
        </h1>
        <p className="text-xl" style={{ color: "var(--text-secondary)" }}>
          AI trading agent for Telegram &amp; Discord.
          <br />
          Connect Robinhood. Trade with AI. Copy the best.
        </p>

        {/* Login options */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <a
            href={`https://t.me/${brand}_bot?start=web`}
            className="btn btn-primary text-lg px-8 py-3"
          >
            <TelegramIcon />
            Open in Telegram
          </a>
          <button
            className="btn btn-secondary text-lg px-8 py-3"
            onClick={() => setLoginMode("discord")}
          >
            <DiscordIcon />
            Open in Discord
          </button>
        </div>

        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <a href="/dashboard" className="underline" style={{ color: "var(--brand-accent)" }}>
            Go to dashboard
          </a>
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mt-20">
        <FeatureCard
          title="AI Chat"
          description="Ask anything — market analysis, research, trade ideas. 25 free messages to start."
          icon="chat"
        />
        <FeatureCard
          title="Trade"
          description="Buy and sell crypto through Robinhood. Human-confirms every order."
          icon="trade"
        />
        <FeatureCard
          title="Copy Trade"
          description="Follow top traders on the rhagent.bot feed. One-click copy."
          icon="copy"
        />
      </div>

      {/* How it works */}
      <div className="max-w-2xl mt-20 space-y-6">
        <h2 className="text-2xl font-semibold text-center">Setup in 30 seconds</h2>
        <div className="space-y-4">
          <Step n={1} text="Open the bot in Telegram or Discord" />
          <Step n={2} text="Send /start — wallet + credits auto-provisioned" />
          <Step n={3} text="Start chatting. Connect Robinhood when ready to trade." />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="card card-hover">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: "var(--brand-accent)", color: "#000" }}
      >
        {n}
      </div>
      <p style={{ color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}
