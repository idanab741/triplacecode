"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { DmChatHeader } from "./DmChatHeader";
import { DmComposer } from "./DmComposer";
import { DmSharedCard } from "./DmSharedCard";
import {
  fetchConversation,
  sendTextMessage,
  type DmMessageDto,
  type DmOtherUserDto,
} from "@/services/social/dmService";

/** הודעה זמנית לתצוגה אופטימית - מוחלפת בהודעה האמיתית מהשרת אחרי
 *  שהשליחה מצליחה, או מוסרת אם השליחה נכשלת (אותו דפוס כמו SupportChatScreen). */
function tempMessage(conversationId: string, senderId: string, text: string): DmMessageDto {
  return {
    id: `temp-${crypto.randomUUID()}`,
    conversationId,
    senderId,
    kind: "text",
    text,
    tripId: null,
    placeId: null,
    postId: null,
    reviewId: null,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

/** תצוגת גיבוי להודעת שיתוף שאין לה תצוגה מקדימה (סוג שלא נתמך עדיין, או שהתוכן נמחק/אינו נגיש).
 *  שיתוף פוסט/מקום מוצג כרגיל דרך DmSharedCard. */
function fallbackLabel(kind: DmMessageDto["kind"]): string {
  switch (kind) {
    case "trip":
      return "📍 שיתוף מסלול";
    case "place":
      return "📍 שיתוף אטרקציה";
    case "post":
      return "🖼️ שיתוף פוסט";
    case "review":
      return "⭐ שיתוף ביקורת";
    default:
      return "";
  }
}

interface DmChatScreenProps {
  conversationId: string;
  currentUserId: string;
}

export function DmChatScreen({ conversationId, currentUserId }: DmChatScreenProps) {
  const router = useRouter();
  const [otherUser, setOtherUser] = useState<DmOtherUserDto | null>(null);
  const [messages, setMessages] = useState<DmMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string>>(new Set());

  async function load(isBackgroundPoll = false) {
    if (!isBackgroundPoll) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await fetchConversation(conversationId);
      setOtherUser(data.otherUser);
      setMessages(data.messages);
      knownIds.current = new Set(data.messages.map((m) => m.id));
    } catch (e) {
      if (!isBackgroundPoll) setLoadError(e instanceof Error ? e.message : "טעינת הצ'אט נכשלה");
    } finally {
      if (!isBackgroundPoll) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // *** "צ'אט רגיל" (בקשה מפורשת) - polling קליל כל 4 שניות כל עוד
    // העמוד פתוח, כדי שהודעות נכנסות מהצד השני יופיעו בלי לרענן ידנית.
    // מספיק ל-MVP; Realtime channels אמיתי (ללא polling) הוא שדרוג עתידי.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSendError(null);
    setSending(true);
    setText("");

    const optimistic = tempMessage(conversationId, currentUserId, trimmed);
    setMessages((all) => [...all, optimistic]);

    try {
      const result = await sendTextMessage(conversationId, trimmed);
      setMessages((all) => all.map((m) => (m.id === optimistic.id ? result : m)));
      knownIds.current.add(result.id);
    } catch (e) {
      setMessages((all) => all.filter((m) => m.id !== optimistic.id));
      setText(trimmed);
      setSendError(e instanceof Error ? e.message : "שליחת ההודעה נכשלה - נסו שוב.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen withBottomNavSpacing className="pb-0">
      <div className="-mx-5 -mt-8">
        <DmChatHeader otherUser={otherUser} onBack={() => router.push("/places/chat")} />
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-56">
        {loading && (
          <div className="flex flex-col gap-3">
            <div className="h-16 w-3/4 animate-pulse rounded-card bg-white" />
            <div className="ms-auto h-10 w-1/2 animate-pulse rounded-card bg-white/70" />
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 rounded-card bg-white p-5 text-center shadow-soft">
            <p className="text-sm text-danger">{loadError}</p>
            <button type="button" onClick={() => load()} className="text-sm font-semibold text-accent">
              נסו שוב
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                <p className="text-[13.5px] text-ink-secondary">אין עדיין הודעות בשיחה הזו.</p>
                <p className="text-[12px] text-ink-secondary/70">כתבו הודעה כדי להתחיל.</p>
              </div>
            )}

            {messages.map((message) => {
              const isMine = message.senderId === currentUserId;
              if (message.shared) return <DmSharedCard key={message.id} message={message} isMine={isMine} />;
              const content = message.kind === "text" ? message.text ?? "" : fallbackLabel(message.kind);
              return isMine ? (
                <UserBubble key={message.id}>{content}</UserBubble>
              ) : (
                <ChatBubble key={message.id}>{content}</ChatBubble>
              );
            })}

            {sendError && <p className="text-center text-sm text-danger">{sendError}</p>}
          </>
        )}

        <div ref={bottom} />
      </div>

      {!loading && !loadError && <DmComposer value={text} onChange={setText} onSend={handleSend} sending={sending} />}

      <MainBottomNav active="profile" />
    </Screen>
  );
}
