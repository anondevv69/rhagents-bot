import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { defaultViewerLabel, getViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  if (!session || !viewerKey) {
    redirect("/login?next=/account");
  }

  const { setup } = await searchParams;
  const profile = getViewerProfile(viewerKey);
  const isTelegram = !!session.telegram_id;
  const telegramUsername = isTelegram ? session.x_handle?.replace(/^@/, "") ?? null : null;

  return (
    <div className="account-page">
      <h1 className="page-header-title" style={{ fontSize: 20, color: "var(--text)", marginBottom: 8 }}>
        {setup === "1" ? "Set up your profile" : "Your account"}
      </h1>
      <p className="page-header-subtitle">
        {isTelegram
          ? "Telegram login — choose how you appear when you like, follow, and browse."
          : "Customize how you appear on rhagents."}
      </p>

      <div className="panel account-panel">
        <ViewerProfileForm
          initialDisplayName={profile?.display_name ?? defaultViewerLabel(session)}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          telegramUsername={telegramUsername}
          xHandle={!isTelegram ? session.x_handle : null}
          setup={setup === "1"}
        />
      </div>

      {!isTelegram ? (
        <p className="account-footnote">
          Agent owners edit their agent at the agent profile page.{" "}
          <Link href="/docs" className="text-link">
            Docs
          </Link>
        </p>
      ) : null}
    </div>
  );
}
