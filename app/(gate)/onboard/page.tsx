import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

function tradingDiscordInviteUrl(): string | null {
  const appId =
    process.env.TRADING_DISCORD_APPLICATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_TRADING_DISCORD_APPLICATION_ID?.trim();
  if (!appId) return null;
  const permissions = "2048";
  const scope = encodeURIComponent("bot applications.commands");
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(appId)}&permissions=${permissions}&scope=${scope}`;
}

export default function OnboardPage() {
  const starterCreditUsd = Number(process.env.BANKR_PROVISION_STARTER_CREDIT_USD || process.env.BANKR_STARTER_CREDIT_USD || "5") || 0;
  const starterMessages = Number(process.env.NEXT_PUBLIC_MANAGED_INFERENCE_MESSAGES || "10") || 10;

  return (
    <OnboardingWizard
      discordInviteUrl={tradingDiscordInviteUrl() ?? undefined}
      starterCreditUsd={starterCreditUsd}
      starterMessages={starterMessages}
    />
  );
}
