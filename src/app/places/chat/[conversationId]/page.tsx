import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { DmChatScreen } from "@/screens/chat/DmChatScreen";

/**
 * עמוד שיחת צ'אט פרטית בודדת עם משתמש אחר - /places/chat/[conversationId].
 * ה-conversationId עצמו לא מגיע בעמוד השרת (ר' DmChatScreen שטוען אותה
 * דרך /api/social/conversations/[id] - כולל בדיקת בעלות ב-RLS), רק
 * מוודא כאן שיש בכלל משתמש מחובר לפני שמרנדרים את מסך הצ'אט.
 */
export default async function DmConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return <DmChatScreen conversationId={conversationId} currentUserId={user.id} />;
}
