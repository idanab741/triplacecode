"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { StoryRailAuthorDto } from "@/services/social/storyService";
import { getAvatarUrl } from "@/constants/avatar";

/** "לפני X דקות/שעות" - יחסי, בעברית, בהתאם לגודל הפרש הזמן. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  return `לפני ${hours} ש'`;
}

interface StoryViewerModalProps {
  rail: StoryRailAuthorDto[];
  startAuthorIndex: number;
  /** ה-id של המשתמש הצופה - קובע אם מוצג כפתור המחיקה (רק על הסטורי של עצמי). */
  viewerId: string;
  onClose: () => void;
  onView: (storyId: string) => void;
  /** נקרא אחרי מחיקה מוצלחת בשרת - ההורה אחראי לעדכן את ה-state שלו. */
  onDelete: (storyId: string) => Promise<void>;
}

/** Full-screen Story Viewer: tap next/previous, close, מעבר אוטומטי בין
 *  Stories של אותו מחבר ולאחר מכן למחבר הבא (סעיף 6 באפיון). */
export function StoryViewerModal({ rail, startAuthorIndex, viewerId, onClose, onView, onDelete }: StoryViewerModalProps) {
  const router = useRouter();
  const [authorIndex, setAuthorIndex] = useState(startAuthorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [replyText, setReplyText] = useState("");

  const author = rail[authorIndex];
  const story = author?.stories[storyIndex];
  const isOwnStory = author?.author.id === viewerId;

  const goNext = useCallback(() => {
    if (!author) return;
    if (storyIndex < author.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (authorIndex < rail.length - 1) {
      setAuthorIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [author, storyIndex, authorIndex, rail.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (authorIndex > 0) {
      setAuthorIndex((i) => i - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, authorIndex]);

  useEffect(() => {
    if (story) onView(story.id);
    // כשמאשרים מחיקה, או כשמקלידים תגובה, עוצרים את הטיימר האוטומטי -
    // לא רוצים שהסטורי "יברח" באמצע פעולה.
    if (paused) return;
    const timer = setTimeout(goNext, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorIndex, storyIndex, paused]);

  async function handleConfirmDelete() {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      const wasLastStoryOfAuthor = author!.stories.length === 1;
      const deletedId = story.id;
      await onDelete(deletedId);
      if (wasLastStoryOfAuthor) {
        // אין עוד סטוריז למחבר הזה - עוברים לבא בתור, או סוגרים אם זה היה האחרון.
        if (authorIndex < rail.length - 1) {
          setAuthorIndex((i) => i);
          setStoryIndex(0);
        } else if (authorIndex > 0) {
          setAuthorIndex((i) => i - 1);
          setStoryIndex(0);
        } else {
          onClose();
        }
      } else if (storyIndex >= author!.stories.length - 1) {
        setStoryIndex((i) => Math.max(0, i - 1));
      }
      setConfirmingDelete(false);
      setPaused(false);
    } catch {
      // best-effort - אם המחיקה נכשלה פשוט משאירים את הדיאלוג פתוח
      // כדי שהמשתמש יוכל לנסות שוב.
    } finally {
      setDeleting(false);
    }
  }

  function handleSendReply() {
    if (!replyText.trim()) return;
    // מערכת ה-Chat המלאה (Direct Messages) עדיין לא קיימת באפליקציה
    // (שלב 2 באפיון) - כרגע מעבירים ישר לעמוד ה-Chat הקיים, בלי להעמיד
    // פנים ששלחנו הודעה בפועל. כשה-Chat האמיתי ייבנה, כאן תתחבר יצירת
    // שיחה ישירה עם author.author.id וההודעה תישלח אליה במקום.
    router.push("/places/chat");
  }

  if (!author || !story) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex gap-1 px-3 pt-3">
        {author.stories.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all"
              style={{ width: i < storyIndex ? "100%" : i === storyIndex ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 overflow-hidden rounded-full bg-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(author.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="text-[13px] font-semibold text-white">{author.author.fullName ?? author.author.username}</span>
          <span className="text-[12px] text-white/70">{timeAgo(story.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          {isOwnStory && (
            <button
              type="button"
              onClick={() => {
                setPaused(true);
                setConfirmingDelete(true);
              }}
              aria-label="מחיקת סטורי"
              className="p-2 text-white"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="סגור" className="p-2 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-0">
        {story.media[0] &&
          (story.media[0].type === "video" ? (
            <video src={story.media[0].url} className="h-full w-full object-contain" autoPlay muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.media[0].url} alt="" className="h-full w-full object-contain" />
          ))}

        {story.text && (
          <p
            className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[20px] font-bold leading-relaxed text-white"
            style={story.media[0] ? { textShadow: "0 2px 8px rgba(0,0,0,0.6)" } : undefined}
          >
            {story.text}
          </p>
        )}

        {!confirmingDelete && (
          <>
            <button type="button" aria-label="הקודם" onClick={goPrev} className="absolute inset-y-0 start-0 w-1/3" />
            <button type="button" aria-label="הבא" onClick={goNext} className="absolute inset-y-0 end-0 w-1/3" />
          </>
        )}

        {confirmingDelete && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-8">
            <div className="w-full max-w-xs rounded-card bg-white p-5 text-center">
              <p className="mb-4 text-[14px] font-semibold text-ink">למחוק את הסטורי הזה?</p>
              <p className="mb-5 text-[12.5px] text-ink-secondary">הפעולה לא הפיכה - הסטורי יימחק לצמיתות.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setPaused(false);
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-pill border border-ink-secondary/20 py-2.5 text-[13.5px] font-semibold text-ink disabled:opacity-60"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 rounded-pill bg-danger py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "מוחק..." : "מחיקה"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* תגובה לסטורי - לא נשלחת בפועל (מערכת ה-Chat המלאה עדיין לא
          קיימת, ר' הערה ב-handleSendReply), אבל גם לא כפתור-שקר: לחיצה
          מעבירה בפועל לעמוד ה-Chat הקיים באפליקציה. */}
      {!isOwnStory && !confirmingDelete && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendReply();
          }}
          className="flex items-center gap-2 px-3 pb-4 pt-1"
        >
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onFocus={() => setPaused(true)}
            onBlur={() => !replyText && setPaused(false)}
            placeholder="הגיבו לסטורי..."
            className="flex-1 rounded-pill border border-white/30 bg-white/10 px-4 py-2.5 text-[13.5px] text-white placeholder:text-white/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!replyText.trim()}
            aria-label="שליחה"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
              <path d="M4 12l16-8-6 16-3-7-7-1z" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      )}
      {(isOwnStory || confirmingDelete) && <div className="h-6" />}
    </div>
  );
}
