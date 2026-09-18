"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { SupportChatHeader } from "./SupportChatHeader";
import { SupportComposer } from "./SupportComposer";
import {
  ensureConversation,
  fetchMyConversation,
  sendSupportMessage,
  type SupportConversationDto,
  type SupportMessageDto,
} from "@/services/support/supportService";

const OPENING_MESSAGE = "שלום! 👋\nאיך אפשר לעזור לכם?\nשלחו לנו הודעה ונציג שירות יחזור אליכם בהקדם.";

/** הודעה זמנית לתצוגה אופטימית - מוחלפת בהודעה האמיתית מהשרת אחרי
 *  שהשליחה מצליחה (id/createdAt אמיתיים), או מוסרת אם השליחה נכשלת. */
function tempMessage(text: string): SupportMessageDto {
  return {
    id: `temp-${crypto.randomUUID()}`,
    conversationId: "",
    senderType: "user",
    message: text,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * מסך "צ'אט שירות לקוחות" - מודל על אותה שפה חזותית של Trippy AI (header/
 * bubbles/composer קבוע בתחתית), אבל שיחה אנושית נפרדת לגמרי: אין קריאה
 * ל-AI, אין תשובות אוטומטיות - רק שמירת הודעות ב-DB והמתנה למענה אנושי.
 */
export function SupportChatScreen() {
  const router = useRouter();
  const [conversation, setConversation] = useState<SupportConversationDto | null>(null);
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchMyConversation();
      setConversation(data.conversation);
      setMessages(data.messages);
      conversationIdRef.current = data.conversation?.id ?? null;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "טעינת הצ'אט נכשלה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSendError(null);
    setSending(true);
    setText(""); // ניקוי אופטימי - אם השליחה תיכשל, נשחזר את הטקסט למטה

    const optimistic = tempMessage(trimmed);
    setMessages((all) => [...all, optimistic]);

    try {
      let conversationId = conversationIdRef.current;
      if (!conversationId) {
        const created = await ensureConversation();
        conversationId = created.id;
        conversationIdRef.current = created.id;
        setConversation(created);
      }

      const result = await sendSupportMessage(conversationId, trimmed);
      setMessages((all) => all.map((m) => (m.id === optimistic.id ? result.message : m)));
      setConversation(result.conversation);
    } catch (e) {
      setMessages((all) => all.filter((m) => m.id !== optimistic.id));
      setText(trimmed); // לא לאבד את הטקסט שהמשתמש כתב
      setSendError(e instanceof Error ? e.message : "שליחת ההודעה נכשלה - נסו שוב.");
    } finally {
      setSending(false);
    }
  }

  const hasConversationStarted = messages.length > 0;

  return (
    <Screen withBottomNavSpacing className="pb-0">
      <div className="-mx-5 -mt-8">
        <SupportChatHeader onBack={() => router.push("/profile")} />
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
            <button type="button" onClick={load} className="text-sm font-semibold text-accent">
              נסו שוב
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {!hasConversationStarted && <ChatBubble>{OPENING_MESSAGE}</ChatBubble>}

            {messages.map((message) =>
              message.senderType === "admin" ? (
                <ChatBubble key={message.id}>{message.message}</ChatBubble>
              ) : (
                <UserBubble key={message.id}>{message.message}</UserBubble>
              )
            )}

            {/* "מענה תוך 24 שעות" - חלק קבוע מחוויית הצ'אט (לא הודעת משתמש/מערכת
                נפרדת), כדי שיהיה ברור כל הזמן שהמענה אינו מיידי. */}
            <div className="flex justify-center">
              <span className="rounded-pill bg-bg-secondary px-3 py-1 text-xs font-medium text-ink-secondary">
                ⏱️ מענה תוך 24 שעות
              </span>
            </div>

            {sendError && <p className="text-center text-sm text-danger">{sendError}</p>}
          </>
        )}

        <div ref={bottom} />
      </div>

      {!loading && !loadError && <SupportComposer value={text} onChange={setText} onSend={handleSend} sending={sending} />}

      <MainBottomNav active="profile" />
    </Screen>
  );
}
