"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { Skeleton } from "@/components/ui";
import { getAvatarUrl } from "@/constants/avatar";
import { OnlineFriendsSection } from "@/screens/places/OnlineFriendsSection";
import type { OnlineFriendDto } from "@/services/social/onlinePresenceService";
import { ensureConversation, listConversations, type DmConversationListItemDto } from "@/services/social/dmService";
import { formatRelativeTimeHe } from "@/utils/relativeTime";

interface PersonResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

/** תצוגה מקדימה של ההודעה האחרונה בשיחה - "אתה: ..." אם ההודעה שלי,
 *  אחרת הטקסט עצמו. שיתוף (trip/place/post/review) עדיין תמיד text=null
 *  כרגע (kind='text' בלבד נתמך בשליחה) - שם קריא כגיבוי לשלב הבא. */
function lastMessagePreview(item: DmConversationListItemDto): string {
  if (!item.lastMessage) return "עדיין אין הודעות";
  const body =
    item.lastMessage.kind === "text"
      ? item.lastMessage.text ?? ""
      : { trip: "📍 שיתוף מסלול", place: "📍 שיתוף אטרקציה", post: "🖼️ שיתוף פוסט", review: "⭐ שיתוף ביקורת" }[item.lastMessage.kind];
  return item.lastMessage.isMine ? `אתה: ${body}` : body;
}


/**
 * "צ'אטים" - עמוד אחד לכל השיחות: בר עליון קבוע של triplace (כולל חיפוש), שיחה ראשונה עם triplace
 * נעוצה (הודעות מערכת ושירות לקוחות, /support), ואחריה שאר השיחות האמיתיות עם משתמשים אחרים (ר'
 * dmService.ts + migration 0093) - לא רשימה מדומה.
 *
 * *** תיקון (בקשה מפורשת - "אי אפשר לשלוח הודעות למשתמשים! זה מוביל לעמוד הפרופיל במקום לעמוד צ'אט"):
 * לחיצה על תוצאת חיפוש כבר לא פותחת פרופיל - פותחת (או יוצרת, אם זו הפעם הראשונה) שיחה אמיתית עם אותו
 * משתמש ומנווטת אליה (/places/chat/[conversationId], DmChatScreen). אותו דבר לכל שיחה קיימת ברשימה.
 */
export default function ChatsInboxPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriendDto[]>([]);
  const [conversations, setConversations] = useState<DmConversationListItemDto[] | null>(null);
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* שיחות אמיתיות עם משתמשים אחרים - ר' dmService.ts. נטען פעם אחת
     בכניסה לעמוד; מתעדכן שוב אחרי חזרה משיחה (focus) כדי לשקף הודעות
     חדשות/נקראו בלי לדרוש רענון ידני. */
  useEffect(() => {
    function loadConversations() {
      listConversations()
        .then(setConversations)
        .catch(() => setConversations([]));
    }
    loadConversations();
    window.addEventListener("focus", loadConversations);
    return () => window.removeEventListener("focus", loadConversations);
  }, []);

  /* "מחוברים עכשיו" - מוצג *רק* בעמוד הזה (בקשה מפורשת, הוסר מעמוד Places):
     כל מי שיש עמו עקיבה הדדית (אני עוקב אחריו *והוא* עוקב אחריי) - ראה
     onlinePresenceService.getOnlineFriends. ה-heartbeat כאן מעדכן את ה-
     last_seen של המשתמש הנוכחי גם כשהוא לא ביקר בעמוד Places בכלל. */
  useEffect(() => {
    // *** מתרענן כל 45 שניות (וכשחוזרים לעמוד) - כדי שירוק/צהוב ישקפו את המצב הנוכחי ולא רק את
    // הרגע שבו העמוד נפתח. ה-heartbeat של המשתמש עצמו רץ עכשיו גלובלית (MainBottomNav).
    function loadOnline() {
      fetch("/api/social/presence/online-friends")
        .then((res) => res.json())
        .then((data) => setOnlineFriends(data.friends ?? []))
        .catch(() => {});
    }
    loadOnline();
    fetch("/api/social/presence/heartbeat", { method: "POST" }).catch(() => {});
    const timer = setInterval(loadOnline, 45_000);
    window.addEventListener("focus", loadOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", loadOnline);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/social/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data) => setResults(data.people ?? []))
        .catch(() => setResults([]));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /* פותחת (או יוצרת) שיחה עם משתמש ומנווטת לעמוד הצ'אט שלה - זו הנקודה
     היחידה שמחליפה את הניווט הישן לפרופיל (בקשה מפורשת). */
  async function openChatWith(userId: string) {
    setOpenError(null);
    setOpeningUserId(userId);
    try {
      const conversation = await ensureConversation(userId);
      router.push(`/places/chat/${conversation.id}`);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "פתיחת הצ'אט נכשלה");
      setOpeningUserId(null);
    }
  }


  return (
    <div className="min-h-screen bg-white pb-24">
      <HomeStatusBarTint />
      {/* *** תיקון (בקשה מפורשת - "למה החיפוש שם? הוא יכול להיות חלק מהבר העליון!"): שורת החיפוש עברה
          לתוך הבר עצמו (children של CollapsibleTopBar) - אותו מנגנון בדיוק כמו בעמוד הבית: יושבת על
          הגרדיאנט הכחול, ומצטמצמת/נעלמת בגלילה יחד עם שאר הבר. אין יותר תיבת חיפוש נפרדת מתחתיו. */}
      {/* *** תיקון (בקשה מפורשת - "למה זה לא אותו בר עליון כמו בעמוד הבית?! שיהיה בדיוק כמו שם, רק עם
          הכיתוב 'חפש אנשים'"): לא עוד תיבה מותאמת-אישית - אותו markup וקלאסים בדיוק כמו שורת החיפוש
          "hero" בעמוד הבית (SearchBarLink, variant="hero"): פיל לבן בגובה 48px, אייקון זכוכית-מגדלת
          בכחול המותג, אותו placeholder-style, אותה מסגרת פוקוס. רק ה-placeholder עצמו שונה ("חפש אנשים").
          לא נעשה שימוש ברכיב SearchBarLink עצמו כי הוא בנוי כולו סביב חיפוש מקומות/יעדים (autocomplete,
          ניווט ל-/search) - לא מתאים לחיפוש אנשים; הועתק רק העיצוב שלו, בדיוק. */}
      {/* *** תיקון (בקשה מפורשת - "צריך כפתור חזור!"): onBack חוזר - כפתור "חזור" האמיתי של האפליקציה
          במקום כפתור הצ'אט (בדיוק אותו מנגנון של HomeHeader/CollapsibleTopBar בכל שאר העמודים
          ה"פנימיים"). שאר הבר (גרדיאנט, לוגו, פעמון, שורת החיפוש) נשאר זהה לעמוד הבית. */}
      {/* *** תיקון (בקשה מפורשת - "למה הרוחב של שורת החיפוש לא זהה לעמוד הבית?"): ה-mx-6 כאן התווסף
          *מעל* ה-px-5 שה-CollapsibleTopBar כבר שם על ה-children שלו (בדיוק כמו בעמוד הבית) - שני
          המרווחים ביחד הצרו את השורה יותר מהבית. בעמוד הבית ה-div העוטף (data-home-search) בלי שום
          מרווח נוסף משלו - רק ה-px-5 של הבר קובע את הרוחב. הוסר ה-mx-6, בדיוק כמו בבית. */}
      <CollapsibleTopBar onBack={() => router.back()}>
        <div data-home-search="" className="relative">
          <div className="flex h-12 items-center gap-2.5 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_6px_18px_-6px_rgba(0,50,120,0.4)] transition focus-within:ring-2 focus-within:ring-white/70">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-end)" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש אנשים..."
              className="w-full min-w-0 bg-transparent font-medium text-ink placeholder:font-normal placeholder:text-ink-secondary focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="ניקוי" className="shrink-0 text-ink-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </CollapsibleTopBar>

      {/* *** תיקון (בקשה מפורשת - "הטקסט 'צ'אטים' צריך להיות מתחת לבלוק של מחוברים עכשיו"): הכותרת
          הוזזה מתחת לבלוק "מחוברים עכשיו" (לפני זה הייתה מעליו). הבלוק עצמו עדיין לא מוצג בזמן
          חיפוש אנשים ולא מוצג כשאין חברים מחוברים (OnlineFriendsSection מחזיר null במקרה הזה). */}
      {!query.trim() && (
        <div className="pt-5">
          <OnlineFriendsSection friends={onlineFriends} onSelect={openChatWith} busyId={openingUserId} />
        </div>
      )}

      <h1 className="px-5 pb-1 pt-5 text-xl font-bold text-ink">צ&apos;אטים</h1>

      {query.trim() ? (
        <div className="flex flex-col px-2 pt-2">
          {results === null ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13.5px] text-ink-secondary">לא נמצאו אנשים בשם הזה.</p>
          ) : (
            results.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => openChatWith(person.id)}
                disabled={openingUserId === person.id}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-start transition active:bg-bg-secondary disabled:opacity-60"
              >
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(person.avatar_url)} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-[14.5px] font-bold text-ink">{person.full_name || person.username}</span>
                  {person.username && <span className="block truncate text-[12.5px] text-ink-secondary">@{person.username}</span>}
                </span>
                {openingUserId === person.id && (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink-secondary/30 border-t-ink-secondary" />
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col px-2 pt-2">
          {/* *** תיקון (בקשה מפורשת - "ההודעה הראשונה איפה שtriplace צריכה להיות הודעות מערכת
              ושירות לקוחות!"): זו כבר לא שיחת Trippy AI (/ai) - זו שיחת "הודעות מערכת ושירות
              לקוחות" הקיימת (/support, SupportChatScreen), עם אווטאר המותג (התמונה שנשלחה)
              במקום אייקון בועת-הצ'אט הגנרי. */}
          <Link href="/support" className="flex items-center gap-3 rounded-2xl px-3 py-3 transition active:bg-bg-secondary">
            <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
              <Image
                src="/images/triplace-avatar.png"
                alt="triplace"
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-[14.5px] font-bold text-ink">triplace</span>
              <span className="block truncate text-[12.5px] text-ink-secondary">הודעות מערכת ושירות לקוחות</span>
            </span>
          </Link>

          {/* *** תיקון (בקשה מפורשת - "לא צריך את הנעץ, צריך פשוט הפרדה מהצ'אטים האחרים עם קו ארוך רוחבי"):
              בלי 📌 - קו מלא לכל רוחב העמוד (לא רק בתוך השורה) מפריד בין triplace לשאר השיחות. */}
          <hr className="-mx-2 my-2 border-t border-ink-secondary/12" />

          {openError && <p className="px-4 py-2 text-center text-[13px] text-danger">{openError}</p>}

          {/* *** תיקון (בקשה מפורשת - "אי אפשר לפתח שיחה בנתיים עם אף בן אדם! זה מוביל לעמוד הפרופיל
              במקום לעמוד צ'אט"): שיחות אמיתיות עם משתמשים אחרים, לא רשימה מדומה - dmService.ts +
              migration 0093. לחיצה פותחת את עמוד השיחה (/places/chat/[id]), לא את הפרופיל. */}
          {conversations === null ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
              <p className="text-[13.5px] text-ink-secondary">אין עדיין שיחות עם משתמשים אחרים.</p>
              <p className="text-[12px] text-ink-secondary/70">חפשו אדם למעלה כדי להתחיל שיחה.</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/places/chat/${conversation.id}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 transition active:bg-bg-secondary"
              >
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(conversation.otherUser?.avatarUrl)} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14.5px] font-bold text-ink">
                      {conversation.otherUser?.fullName || conversation.otherUser?.username || "משתמש"}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-secondary">{formatRelativeTimeHe(conversation.lastMessageAt)}</span>
                  </span>
                  <span className={`block truncate text-[12.5px] ${conversation.unreadCount > 0 ? "font-bold text-ink" : "text-ink-secondary"}`}>
                    {lastMessagePreview(conversation)}
                  </span>
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {/* *** תיקון (בקשה מפורשת - "למה אין בר תחתון?" ואז - "שבבר התחתון זה יהיה תחת פרופיל, לא places!"):
          הבר התחתון האמיתי של האפליקציה (לא עותק), עם הטאב "פרופיל" מודגש - לא "מקומות". */}
      <MainBottomNav active="profile" />
    </div>
  );
}
