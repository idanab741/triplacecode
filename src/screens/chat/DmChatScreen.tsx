"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { DmChatHeader } from "./DmChatHeader";
import { DmComposer } from "./DmComposer";
import { DmSharedCard } from "./DmSharedCard";
import { useKeyboardInset } from "./useKeyboardInset";
import { dayKey, dayLabel, timeLabel } from "./chatTime";
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

/** בועת הודעה עם השעה בפינה (כמו בוואטסאפ). שלי - כחול, בצד השמאלי; של הצד השני - לבן, בצד הימני. */
function DmBubble({ text, time, isMine, pending }: { text: string; time: string; isMine: boolean; pending: boolean }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] px-3.5 pb-1.5 pt-2 ${isMine ? "text-white" : "bg-white text-ink shadow-[0_2px_8px_rgba(16,24,40,0.06)]"}`}
        style={{
          borderRadius: 18,
          ...(isMine
            ? { borderBottomLeftRadius: 5, background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))", boxShadow: "0 4px 12px rgba(24,119,242,0.22)" }
            : { borderBottomRightRadius: 5 }),
        }}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{text}</p>
        <p className={`mt-0.5 text-start text-[11px] leading-4 tabular-nums ${isMine ? "text-white/75" : "text-ink-secondary"}`} dir="ltr">
          {pending ? "שולח..." : time}
        </p>
      </div>
    </div>
  );
}

/** מפריד יום באמצע הצ'אט - "היום", "אתמול", "יום שלישי", "12 בספטמבר" */
function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-ink-secondary shadow-[0_1px_4px_rgba(16,24,40,0.08)] backdrop-blur">
        {label}
      </span>
    </div>
  );
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
  const lastSignature = useRef("");
  const keyboardInset = useKeyboardInset();

  async function load(isBackgroundPoll = false) {
    if (!isBackgroundPoll) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await fetchConversation(conversationId);
      setOtherUser(data.otherUser);
      // ב-polling - מעדכנים רק אם באמת השתנה משהו (אחרת כל 4 שניות היה רינדור + גלילה באמצע הקלדה)
      const signature = data.messages.map((m) => `${m.id}:${m.readAt ?? ""}`).join(",");
      if (signature !== lastSignature.current) {
        lastSignature.current = signature;
        setMessages(data.messages);
      }
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

  // גוללים לתחתית רק כשנוספה הודעה חדשה (או בטעינה הראשונה) - לא בכל רענון
  const lastId = messages[messages.length - 1]?.id ?? "";
  const scrolledOnce = useRef(false);
  useEffect(() => {
    if (loading || !lastId) return;
    bottom.current?.scrollIntoView({ behavior: scrolledOnce.current ? "smooth" : "auto", block: "end" });
    scrolledOnce.current = true;
  }, [lastId, loading]);

  // המקלדת נפתחה - ההודעה האחרונה נשארת גלויה מעל שורת ההקלדה
  useEffect(() => {
    if (keyboardInset > 0) bottom.current?.scrollIntoView({ block: "end" });
  }, [keyboardInset]);

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

      <div className="mx-auto flex max-w-md flex-col px-1 pt-2" style={{ paddingBottom: keyboardInset > 0 ? keyboardInset + 88 : 224 }}>
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

            {/* *** בקשה מפורשת ("חלוקה של ימים בצ'אט + אלמנטים של שעות"): מפריד לכל יום, ושעה בכל הודעה.
                הודעות רצופות של אותו צד צמודות יותר (כמו בוואטסאפ / iMessage). */}
            {messages.map((message, i) => {
              const isMine = message.senderId === currentUserId;
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
              const gap = newDay ? "" : prev.senderId === message.senderId ? "mt-1" : "mt-3";
              const time = timeLabel(message.createdAt);
              const content = message.kind === "text" ? message.text ?? "" : fallbackLabel(message.kind);
              return (
                <div key={message.id} className={gap}>
                  {newDay && <DayDivider label={dayLabel(message.createdAt)} />}
                  {message.shared ? (
                    <>
                      <DmSharedCard message={message} isMine={isMine} />
                      <p className={`mt-1 px-1 text-[11px] tabular-nums text-ink-secondary ${isMine ? "text-end" : "text-start"}`}>{time}</p>
                    </>
                  ) : (
                    <DmBubble text={content} time={time} isMine={isMine} pending={message.id.startsWith("temp-")} />
                  )}
                </div>
              );
            })}

            {sendError && <p className="mt-3 text-center text-sm text-danger">{sendError}</p>}
          </>
        )}

        <div ref={bottom} />
      </div>

      {!loading && !loadError && <DmComposer value={text} onChange={setText} onSend={handleSend} sending={sending} keyboardInset={keyboardInset} />}

      {/* כשהמקלדת פתוחה הבר התחתון מוסתר - שלא "יצוף" בין ההודעות לשורת ההקלדה */}
      {keyboardInset === 0 && <MainBottomNav active="profile" />}
    </Screen>
  );
}
