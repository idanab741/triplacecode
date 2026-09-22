import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { getProfileByUsername } from "@/services/social/socialProfileService";
import { getProfileContent } from "@/services/social/profileContentService";
import ProfileView from "./ProfileView";
import ProfileNotFound from "./ProfileNotFound";

/**
 * עמוד פרופיל - Server Component. *** מהירות (בקשה מפורשת - "הפרופיל נטען המון זמן, הכל צריך להיות מהיר וישר"):
 * הנתונים נשלפים כאן, בשרת, ומגיעים כבר בתוך ה-HTML - בלי מפל הבקשות שהיה בצד הלקוח
 * (טעינת JS -> useAuth -> /api/profile -> אז /api/content). הפרופיל ותוכן העמוד הראשון נשלפים במקביל.
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profile, initialContent] = await Promise.all([
    getProfileByUsername(supabase, username, user.id),
    // ה-id של המשתמש נדרש לתוכן: שאילתה קטנה (id בלבד) במקביל לשאילתת הפרופיל, ואז התוכן (2 סבבי רשת).
    (async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
      return data ? getProfileContent(supabase, data.id, "all").catch(() => null) : null;
    })(),
  ]);

  if (!profile) return <ProfileNotFound username={username} />;
  return <ProfileView key={profile.id} username={profile.username ?? username} initialProfile={profile} initialContent={initialContent} />;
}
