"use client";

import { useEffect, useState, useCallback } from "react";
import type { StoryRailAuthorDto } from "@/services/social/storyService";

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
  onClose: () => void;
  onView: (storyId: string) => void;
}

/** Full-screen Story Viewer: tap next/previous, close, מעבר אוטומטי בין
 *  Stories של אותו מחבר ולאחר מכן למחבר הבא (סעיף 6 באפיון). */
export function StoryViewerModal({ rail, startAuthorIndex, onClose, onView }: StoryViewerModalProps) {
  const [authorIndex, setAuthorIndex] = useState(startAuthorIndex);
  const [storyIndex, setStoryIndex] = useState(0);

  const author = rail[authorIndex];
  const story = author?.stories[storyIndex];

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
    const timer = setTimeout(goNext, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorIndex, storyIndex]);

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
            {author.author.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.author.avatarUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <span className="text-[13px] font-semibold text-white">{author.author.fullName ?? author.author.username}</span>
          <span className="text-[12px] text-white/70">{timeAgo(story.createdAt)}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="סגור" className="p-2 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
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

        <button type="button" aria-label="הקודם" onClick={goPrev} className="absolute inset-y-0 start-0 w-1/3" />
        <button type="button" aria-label="הבא" onClick={goNext} className="absolute inset-y-0 end-0 w-1/3" />
      </div>

      {/* מענה לסטורי (Direct Chat) יתחבר כאן בשלב 2, כשמערכת ה-Chat קיימת -
          אין להציג כאן שדה קלט שלא מוביל לשום מקום (סעיף 121). */}
      <div className="h-6" />
    </div>
  );
}
