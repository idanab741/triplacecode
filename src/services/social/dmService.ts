import type { DmMessageDto } from "./dmMappers";

export type { DmMessageDto };

export interface DmConversationDto {
  id: string;
  otherUserId: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface DmOtherUserDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface DmConversationListItemDto extends DmConversationDto {
  otherUser: DmOtherUserDto | null;
  lastMessage: { kind: DmMessageDto["kind"]; text: string | null; isMine: boolean; createdAt: string } | null;
  unreadCount: number;
}

/** תיבת הצ'אטים של המשתמש המחובר - כל שיחה עם פרופיל הצד השני, תצוגה
 *  מקדימה, ומספר הודעות שלא נקראו. ממוין לפי ההודעה האחרונה. */
export async function listConversations(): Promise<DmConversationListItemDto[]> {
  const res = await fetch("/api/social/conversations");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "טעינת השיחות נכשלה");
  return data.conversations as DmConversationListItemDto[];
}

/** פותחת שיחה עם משתמש - אידמפוטנטי, אם כבר קיימת פשוט מחזירה אותה.
 *  נקראת לפני ניווט לעמוד הצ'אט (מתוצאת חיפוש, מכפתור "הודעה" בפרופיל וכו'). */
export async function ensureConversation(otherUserId: string): Promise<DmConversationDto> {
  const res = await fetch("/api/social/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: otherUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "פתיחת הצ'אט נכשלה");
  return data.conversation as DmConversationDto;
}

interface FetchConversationResult {
  conversation: DmConversationDto;
  otherUser: DmOtherUserDto | null;
  messages: DmMessageDto[];
}

/** טוענת שיחה קיימת + כל ההודעות. נקודת הכניסה של עמוד הצ'אט בטעינה. */
export async function fetchConversation(conversationId: string): Promise<FetchConversationResult> {
  const res = await fetch(`/api/social/conversations/${conversationId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "טעינת הצ'אט נכשלה");
  return data as FetchConversationResult;
}

export async function sendTextMessage(conversationId: string, text: string): Promise<DmMessageDto> {
  const res = await fetch(`/api/social/conversations/${conversationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "שליחת ההודעה נכשלה");
  return data.message as DmMessageDto;
}
