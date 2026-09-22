/**
 * טיפוסי השורות הגולמיות מה-DB (ר' migration 0093) + פונקציות מיפוי
 * ל-camelCase לתגובות ה-API. משותף בין כל ה-routes של הצ'אט הפרטי.
 */

export type DmMessageKind = "text" | "trip" | "place" | "post" | "review";

export interface DmConversationRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
  last_message_at: string;
}

export interface DmMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: DmMessageKind;
  text: string | null;
  trip_id: string | null;
  place_id: string | null;
  post_id: string | null;
  review_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DmConversationDto {
  id: string;
  /** צד השיחה שאינו המשתמש הנוכחי - הצד ה"אחר" מנקודת המבט של מי שקורא. */
  otherUserId: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface DmMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  kind: DmMessageKind;
  text: string | null;
  tripId: string | null;
  placeId: string | null;
  postId: string | null;
  reviewId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function getOtherUserId(row: DmConversationRow, viewerId: string): string {
  return row.user_a_id === viewerId ? row.user_b_id : row.user_a_id;
}

export function mapConversationRow(row: DmConversationRow, viewerId: string): DmConversationDto {
  return {
    id: row.id,
    otherUserId: getOtherUserId(row, viewerId),
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

export function mapMessageRow(row: DmMessageRow): DmMessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind,
    text: row.text,
    tripId: row.trip_id,
    placeId: row.place_id,
    postId: row.post_id,
    reviewId: row.review_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** ה-user_a_id/user_b_id בטבלה תמיד ממוינים (user_a_id < user_b_id, ר'
 *  constraint במיגרציה) - כדי שלא ייווצרו שתי שורות הפוכות לאותו זוג. */
export function orderedPair(userId: string, otherUserId: string): { userAId: string; userBId: string } {
  return userId < otherUserId ? { userAId: userId, userBId: otherUserId } : { userAId: otherUserId, userBId: userId };
}
