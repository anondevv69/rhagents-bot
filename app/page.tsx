import { redirect } from "next/navigation";
import { LandingPitch } from "@/components/LandingPitch";
import { getViewerSession } from "@/lib/viewerSession";

export default async function LandingPage() {
  const session = await getViewerSession();
  if (session) redirect("/feed");

  return (
    <div className="gate-page landing-page landing-page--pitch">
      <LandingPitch />
    </div>
  );
}
