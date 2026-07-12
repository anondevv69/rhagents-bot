import { redirect } from "next/navigation";
import { LandingHero } from "@/components/LandingHero";
import { getViewerSession } from "@/lib/viewerSession";

export default async function LandingPage() {
  const session = await getViewerSession();
  if (session) redirect("/feed");

  return <LandingHero />;
}
