import type { SupportConversationDto, SupportMessageDto } from "./supportMappers";

export type { SupportConversationDto, SupportMessageDto };

interface ConversationResponse {
  conversation: SupportConversationDto | null;
  messages: SupportMessageDto[];
}

/** שולף את שיחת שירות הלקוחות של המשתמש המחובר (אם יש) + כל ההודעות.
 *  נקודת הכניסה היחידה שמצ'אט המשתמש קורא לה בטעינה. */
export async function fetchMyConversation(): Promise<ConversationResponse> {
  const res = await fetch("/api/support/conversations");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "טעינת השיחה נכשלה");
  return data as ConversationResponse;
}

/** יוצרת שיחה אם עוד אין (אידמפוטנטי - אם כבר קיימת, פשוט מחזירה אותה).
 *  נקרא רק לפני שליחת ההודעה הראשונה אי-פעם (conversationId עדיין null). */
export async function ensureConversation(): Promise<SupportConversationDto> {
  const res = await fetch("/api/support/conversations", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "פתיחת השיחה נכשלה");
  return data.conversation as SupportConversationDto;
}

/** שולחת הודעת משתמש לתוך שיחה קיימת. */
export async function sendSupportMessage(
  conversationId: string,
  message: string
): Promise<{ message: SupportMessageDto; conversation: SupportConversationDto }> {
  const res = await fetch(`/api/support/conversations/${conversationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "שליחת ההודעה נכשלה");
  return data as { message: SupportMessageDto; conversation: SupportConversationDto };
}
