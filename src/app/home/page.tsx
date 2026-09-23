import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { getMergedFeedPage } from "@/services/social/feedPageService";
import { PlacesFeedClient } from "@/screens/places/PlacesFeedClient";
import { HomeOnboardingGuard } from "@/screens/home/HomeOnboardingGuard";

/**
 * *** מבנה ניווט חדש (בקשה מפורשת): עמוד הבית מציג עכשיו את הפיד (לשעבר
 * place's) עם "עבורך / חברים". ערימת הכרטיסיות עברה ל-/tripmatch, והמפה
 * היא עמוד place's. Server Component - העמוד הראשון של הפיד מגיע מוכן ב-HTML.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { entries, nextCursor } = await getMergedFeedPage(supabase, user.id, "for_you");

  return (
    <>
      <HomeOnboardingGuard />
      <PlacesFeedClient initialUser={user} initialEntries={entries} initialNextCursor={nextCursor} />
    </>
  );
}
