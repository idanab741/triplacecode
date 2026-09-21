import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { ensureUsername } from "@/services/social/socialProfileService";

/**
 * "הפרופיל שלי" (הטאב בבר התחתון) -> /places/profile/{username שלי}.
 * *** מהירות (בקשה מפורשת - "הפרופיל נטען המון זמן"): הפניה בצד השרת (HTTP redirect) - במקום useAuth + fetch +
 * router.replace בצד הלקוח, שהיו שלושה מעברים לפני שבכלל התחילה טעינת הפרופיל. אם עוד אין username - נוצר אוטומטית
 * (ensureUsername), כמו קודם.
 */
export default async function MyProfileRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const username = data?.username ?? (await ensureUsername(supabase, user.id));
  redirect(`/places/profile/${username}`);
}
