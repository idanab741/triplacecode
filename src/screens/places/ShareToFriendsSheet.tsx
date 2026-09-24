"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BottomSheet } from "@/components/ui";
import { getAvatarUrl } from "@/constants/avatar";
import { ensureConversation, sendSharedMessage, type ShareTarget } from "@/services/social/dmService";

interface Person {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface ShareOption {
  label: string;
  target: ShareTarget;
}

/**
 * *** נבנה מחדש (בקשה מפורשת - "שליחה לחברים לא עובדת, לא נראית טוב ולא מוצאת חברים מהמאגר"):
 *  - מי מופיע: אנשים שדיברתם איתם, מי שאתם עוקבים אחריו ומי שעוקב אחריכם (ר' /api/social/share-recipients);
 *    חיפוש מוצא כל משתמש באפליקציה. קודם נטענה רק טבלת friendships, שתמיד ריקה.
 *  - עיצוב: רשת עיגולים כמו בשיתוף של אינסטגרם - לחיצה מסמנת (טבעת סגולה + וי). שורת ההודעה
 *    וכפתור השליחה מופיעים רק אחרי שבחרתם מישהו.
 *  - השליחה עצמה: אותו מנגנון צ'אט קיים - ההודעה מגיעה לצ'אט הפרטי של כל נמען ככרטיס לחיץ.
 */
export function ShareToFriendsSheet({
  options,
  onClose,
  onSent,
}: {
  options: ShareOption[];
  onClose: () => void;
  /** כמה נמענים קיבלו בהצלחה - כדי שמונה השליחות בכרטיס יעלה מיד. */
  onSent?: (count: number) => void;
}) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  /** נבחרים - נשמרים עם הפרטים, כדי שלא ייעלמו כשמחליפים חיפוש. */
  const [selected, setSelected] = useState<Map<string, Person>>(new Map());
  const [optionIndex, setOptionIndex] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const id = ++requestRef.current;
    const term = query.trim();
    setLoadError(false);
    const timer = setTimeout(
      () => {
        fetch(`/api/social/share-recipients${term ? `?q=${encodeURIComponent(term)}` : ""}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data: { people: Person[] }) => {
            if (id === requestRef.current) setPeople(data.people ?? []);
          })
          .catch(() => {
            if (id === requestRef.current) {
              setLoadError(true);
              setPeople([]);
            }
          });
      },
      term ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [query]);

  function toggle(person: Person) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    const target = options[optionIndex].target;
    let ok = 0;
    for (const personId of selected.keys()) {
      try {
        const conversation = await ensureConversation(personId);
        await sendSharedMessage(conversation.id, target, note);
        ok += 1;
      } catch {
        // ממשיכים לשאר - מדווחים בסוף כמה נשלחו
      }
    }
    setSending(false);
    if (ok === 0) {
      setError("השליחה נכשלה. בדקו את החיבור ונסו שוב.");
      return;
    }
    if (ok < selected.size) setError(`נשלח ל-${ok} מתוך ${selected.size}.`);
    onSent?.(ok);
    setSentCount(ok);
  }

  async function handleCopyLink() {
    const target = options[optionIndex].target;
    const path = target.kind === "post" ? `/places/post/${target.id}` : `/place/${target.id}`;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* אין הרשאת לוח - מתעלמים */
    }
  }

  /** נבחרים שלא מופיעים ברשימה הנוכחית (למשל אחרי חיפוש) - מוצגים ראשונים, כדי שתמיד יהיו גלויים. */
  const visible: Person[] = [
    ...[...selected.values()].filter((p) => !(people ?? []).some((x) => x.id === p.id)),
    ...(people ?? []),
  ];

  const footer =
    sentCount == null && selected.size > 0 ? (
      // pb-8: כפתור tripmatch העגול בולט מעל הבר התחתון ונכנס לתחתית הגיליון - בלי הריווח הזה
      // הוא כיסה את כפתור השליחה (הבר התחתון נשאר גלוי בכוונה, כמו בכל החלונות הקופצים).
      <div className="flex flex-col gap-2.5 px-1 pb-8">
        {error && <p className="text-center text-[13px] text-danger">{error}</p>}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="כתבו הודעה..."
          className="h-11 w-full rounded-xl bg-[#F1F2F5] px-4 text-[15px] text-ink placeholder:text-ink-secondary focus:bg-white focus:outline-none focus:ring-1 focus:ring-places-purple"
        />
        <button
          type="button"
          disabled={sending}
          onClick={handleSend}
          className="h-12 w-full rounded-xl bg-places-purple text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {sending ? "שולחים..." : selected.size === 1 ? "שליחה" : `שליחה ל-${selected.size}`}
        </button>
      </div>
    ) : undefined;

  return (
    <BottomSheet onClose={onClose} footer={footer}>
      <div className={`px-5 ${footer ? "" : "pb-8"}`} style={{ "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties}>
        {/* *** בקשה מפורשת ("בצד מדי"): כותרת ממורכזת כמו בגיליון השיתוף של אינסטגרם, והתוכן עם
            ריווח צד (px-5) - קודם הגיליון לא נתן ריווח, והכותרת נדבקה לקצה המסך. */}
        <div className="relative mb-4 flex h-9 items-center justify-center">
          <h2 className="text-[16px] font-bold text-ink">שליחה</h2>
          <button
            type="button"
            onClick={handleCopyLink}
            aria-label="העתקת קישור"
            className="absolute end-0 top-0 flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-medium text-ink-secondary transition-colors active:bg-black/[0.05]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
            </svg>
            {copied ? "הועתק" : "קישור"}
          </button>
        </div>

        {sentCount != null ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-places-purple text-white">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="text-[16px] font-semibold text-ink">{sentCount === 1 ? "נשלח" : `נשלח ל-${sentCount} אנשים`}</p>
            {error && <p className="text-[13px] text-ink-secondary">{error}</p>}
            <button type="button" onClick={onClose} className="mt-1 h-11 rounded-xl bg-[#EFF1F4] px-8 text-[15px] font-semibold text-ink">
              סגירה
            </button>
          </div>
        ) : (
          <>
            {options.length > 1 && (
              <div className="mb-3 flex rounded-xl bg-[#F1F2F5] p-1" role="tablist" aria-label="מה לשלוח">
                {options.map((o, i) => (
                  <button
                    key={o.label}
                    type="button"
                    role="tab"
                    aria-selected={i === optionIndex}
                    onClick={() => setOptionIndex(i)}
                    className={`h-9 flex-1 rounded-lg text-[14px] transition ${
                      i === optionIndex ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(15,20,25,0.12)]" : "font-medium text-ink-secondary"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            <label className="flex h-11 items-center gap-2.5 rounded-xl bg-[#F1F2F5] px-3.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-places-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-secondary" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי שם"
                aria-label="חיפוש אנשים"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none"
              />
            </label>

            {people === null ? (
              <div className="grid grid-cols-4 gap-x-2 gap-y-4 pt-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span className="h-[60px] w-[60px] animate-pulse rounded-full bg-[#EFF1F4]" />
                    <span className="h-3 w-12 animate-pulse rounded bg-[#F4F5F7]" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-[14.5px] leading-relaxed text-ink-secondary">
                {loadError
                  ? "לא הצלחנו לטעון את הרשימה. נסו שוב."
                  : query.trim()
                    ? "לא נמצאו משתמשים בשם הזה."
                    : "עוד אין אנשים ברשימה. חפשו לפי שם כדי לשלוח לכל משתמש באפליקציה."}
              </p>
            ) : (
              <ul className="grid max-h-[46vh] grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto overscroll-contain pb-2 pt-5">
                {visible.map((p) => {
                  const isSelected = selected.has(p.id);
                  const name = p.fullName ?? p.username ?? "מטייל";
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        aria-pressed={isSelected}
                        aria-label={name}
                        className="flex w-full flex-col items-center gap-1.5 transition active:scale-95"
                      >
                        <span className="relative">
                          <span
                            className={`block h-[60px] w-[60px] overflow-hidden rounded-full bg-[#EFF1F4] transition-shadow ${
                              isSelected ? "shadow-[0_0_0_2.5px_#fff,0_0_0_4.5px_var(--color-places-purple)]" : ""
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getAvatarUrl(p.avatarUrl)} alt="" className="h-full w-full object-cover" />
                          </span>
                          {isSelected && (
                            <span className="absolute -bottom-0.5 -left-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-places-purple text-white ring-2 ring-white">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                            </span>
                          )}
                        </span>
                        <span className={`line-clamp-2 w-full text-center text-[12.5px] leading-tight ${isSelected ? "font-semibold text-ink" : "text-ink"}`}>
                          {name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
