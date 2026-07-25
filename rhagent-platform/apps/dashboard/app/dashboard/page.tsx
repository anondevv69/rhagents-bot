"use client";

import { useState, useEffect } from "react";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "rhagent";

type Tab = "overview" | "portfolio" | "trades" | "feed" | "agent" | "connections" | "settings";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [user, setUser] = useState<any>(null);

  // Read tab from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab;
    if (tab) setActiveTab(tab);
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "portfolio", label: "Portfolio", icon: "briefcase" },
    { id: "trades", label: "Trades", icon: "activity" },
    { id: "feed", label: "Feed", icon: "rss" },
    { id: "agent", label: "Agent", icon: "bot" },
    { id: "connections", label: "Connections", icon: "plug" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 border-r p-4 flex flex-col"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="text-xl font-bold mb-8">
          {brand}<span style={{ color: "var(--brand-accent)" }}>.bot</span>
        </div>

        <nav className="space-y-1 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? "font-medium"
                  : ""
              }`}
              style={{
                background: activeTab === tab.id ? "var(--bg-card)" : "transparent",
                color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          <a href={`https://t.me/${brand}_bot`}>Open in Telegram</a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "trades" && <TradesTab />}
        {activeTab === "feed" && <FeedTab />}
        {activeTab === "agent" && <AgentTab />}
        {activeTab === "connections" && <ConnectionsTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

// ─── Tab Components ───

function OverviewTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Chat Engine" value="Managed" sub="22 messages left" />
        <StatCard label="LLM Credits" value="$4.50" sub="$5.00 starter grant" />
        <StatCard label="Portfolio" value="—" sub="Connect Robinhood to see" />
        <StatCard label="Trades Today" value="0" sub="No trades yet" />
      </div>

      {/* Setup checklist */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
        <div className="space-y-3">
          <ChecklistItem done label="Account created" />
          <ChecklistItem done label="Wallet provisioned" />
          <ChecklistItem done label="Starter credits loaded" />
          <ChecklistItem label="Connect Robinhood Crypto" action="Connect" />
          <ChecklistItem label="Connect Robinhood Agentic" action="Connect" />
          <ChecklistItem label="Link to rhagent.bot" action="Link" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No activity yet. Start chatting in Telegram or Discord.
        </p>
      </div>
    </div>
  );
}

function PortfolioTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      <div className="card">
        <div className="text-center py-12">
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Connect Robinhood to view your portfolio
          </p>
          <button className="btn btn-primary mt-4">Connect Robinhood Crypto</button>
        </div>
      </div>

      {/* Wallet */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Bankr Wallet</h2>
        <div className="space-y-2">
          <Row label="Address" value="0x3e13...d4f1" mono />
          <Row label="LLM Credits" value="$4.50" />
          <Row label="Chain" value="Robinhood Chain / Base" />
        </div>
      </div>
    </div>
  );
}

function TradesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trade History</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm">All</button>
          <button className="btn btn-secondary text-sm">Executed</button>
          <button className="btn btn-secondary text-sm">Pending</button>
        </div>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left py-2 font-medium">Time</th>
              <th className="text-left py-2 font-medium">Symbol</th>
              <th className="text-left py-2 font-medium">Side</th>
              <th className="text-right py-2 font-medium">Amount</th>
              <th className="text-right py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                No trades yet. Chat with the bot to place your first trade.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Copy Trade Feed</h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Live feed from {brand}.bot — copy trades from top performers.
      </p>

      <div className="space-y-4">
        {/* Placeholder feed items */}
        <FeedItem
          agent="AlphaTrader"
          action="Bought $200 ETH"
          time="2 min ago"
          pnl="+2.3%"
        />
        <FeedItem
          agent="CryptoWhale"
          action="Sold $500 BTC"
          time="15 min ago"
          pnl="-0.5%"
        />
        <FeedItem
          agent="DeFiHunter"
          action="Bought $100 SOL"
          time="1 hour ago"
          pnl="+5.1%"
        />
      </div>
    </div>
  );
}

function AgentTab() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([
    { role: "assistant", text: `Welcome to ${brand}. I'm your AI trading assistant. Ask me anything about markets, or say "buy $50 ETH" to stage a trade.` },
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold mb-4">Agent Chat</h1>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[70%] rounded-xl px-4 py-2 text-sm"
              style={{
                background: msg.role === "user" ? "var(--brand-accent)" : "var(--bg-card)",
                color: msg.role === "user" ? "#000" : "var(--text-primary)",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              setMessages((prev) => [...prev, { role: "user", text: input }]);
              setInput("");
              // TODO: Wire to actual API
              setTimeout(() => {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", text: "Agent chat coming soon. Use Telegram for full functionality." },
                ]);
              }, 500);
            }
          }}
          placeholder="Ask anything..."
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button className="btn btn-primary rounded-xl px-6">Send</button>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Connections</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <ConnectionCard
          name="Robinhood Crypto"
          description="Buy and sell crypto through your Robinhood account"
          status="disconnected"
        />
        <ConnectionCard
          name="Robinhood Agentic"
          description="Access Robinhood's AI trading features"
          status="disconnected"
        />
        <ConnectionCard
          name="rhagent.bot"
          description="Post trades to the feed, copy others' trades"
          status="disconnected"
        />
        <ConnectionCard
          name="Bankr Wallet"
          description="On-chain wallet for crypto and LLM credits"
          status="connected"
        />
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">AI Provider</h2>
        <div className="grid grid-cols-3 gap-3">
          <ProviderCard name="Anthropic" selected />
          <ProviderCard name="OpenAI" />
          <ProviderCard name="Grok" />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Bring your own API key for unlimited chat. Use /setkey in Telegram, or enter below.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="sk-ant-..."
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <button className="btn btn-primary text-sm">Save</button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Trading</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Trade confirmation</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Require /confirm before executing trades
            </p>
          </div>
          <div className="badge badge-success">Enabled</div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Max order size</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Maximum USD per single trade
            </p>
          </div>
          <span className="font-mono">$50</span>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <button className="btn btn-secondary text-sm" style={{ borderColor: "var(--error)", color: "var(--error)" }}>
          Reset Account
        </button>
      </div>
    </div>
  );
}

// ─── Reusable Components ───

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        {sub}
      </p>
    </div>
  );
}

function ChecklistItem({ done, label, action }: { done?: boolean; label: string; action?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
          style={{
            background: done ? "var(--success)" : "var(--bg-primary)",
            border: done ? "none" : "1px solid var(--border)",
            color: done ? "#000" : "var(--text-muted)",
          }}
        >
          {done ? "✓" : ""}
        </div>
        <span className="text-sm" style={{ color: done ? "var(--text-secondary)" : "var(--text-primary)" }}>
          {label}
        </span>
      </div>
      {action && (
        <button className="btn btn-secondary text-xs px-3 py-1">{action}</button>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function FeedItem({ agent, action, time, pnl }: { agent: string; action: string; time: string; pnl: string }) {
  const isPositive = pnl.startsWith("+");
  return (
    <div className="card card-hover flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">{agent}</p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{action}</p>
      </div>
      <div className="text-right">
        <span className={`badge ${isPositive ? "badge-success" : "badge-error"}`}>{pnl}</span>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{time}</p>
      </div>
    </div>
  );
}

function ConnectionCard({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: "connected" | "disconnected" | "pending";
}) {
  return (
    <div className="card card-hover">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold">{name}</h3>
        <span
          className={`badge ${status === "connected" ? "badge-success" : status === "pending" ? "badge-warning" : "badge-neutral"}`}
        >
          {status}
        </span>
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
      {status !== "connected" && (
        <button className="btn btn-primary text-sm w-full">Connect</button>
      )}
    </div>
  );
}

function ProviderCard({ name, selected }: { name: string; selected?: boolean }) {
  return (
    <button
      className="card card-hover text-center py-3 text-sm"
      style={{
        borderColor: selected ? "var(--brand-accent)" : undefined,
      }}
    >
      {name}
    </button>
  );
}
