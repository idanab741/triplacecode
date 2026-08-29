/**
 * טיפוסי השורות הגולמיות מה-DB (ר' migration 0062) + פונקציות מיפוי
 * ל-camelCase לתגובות ה-API. משותף בין כל ה-routes של שירות הלקוחות
 * (משתמש ו-Admin) כדי שלא יהיו כמה מיפויים לא-מסונכרנים לאותה טבלה.
 */

export type SupportConversationStatus = "open" | "waiting_for_admin" | "waiting_for_user" | "closed";

export interface SupportConversationRow {
  id: string;
  user_id: string;
  status: SupportConversationStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface SupportMessageRow {
  id: string;
  conversation_id: string;
  sender_type: "user" | "admin";
  sender_user_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface SupportConversationDto {
  id: string;
  userId: string;
  status: SupportConversationStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  senderType: "user" | "admin";
  message: string;
  readAt: string | null;
  createdAt: string;
}

export function mapConversationRow(row: SupportConversationRow): SupportConversationDto {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  };
}

export function mapMessageRow(row: SupportMessageRow): SupportMessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
