"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { StoryRailAuthorDto } from "@/services/social/storyService";

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
              <Image src={author.author.avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
            )}
          </span>
          <span className="text-[13px] font-semibold text-white">{author.author.fullName ?? author.author.username}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="סגור" className="p-2 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6">
        {story.text && <p className="text-center text-[20px] font-bold leading-relaxed text-white">{story.text}</p>}

        <button type="button" aria-label="הקודם" onClick={goPrev} className="absolute inset-y-0 start-0 w-1/3" />
        <button type="button" aria-label="הבא" onClick={goNext} className="absolute inset-y-0 end-0 w-1/3" />
      </div>

      {/* מענה לסטורי (Direct Chat) יתחבר כאן בשלב 2, כשמערכת ה-Chat קיימת -
          אין להציג כאן שדה קלט שלא מוביל לשום מקום (סעיף 121). */}
      <div className="h-6" />
    </div>
  );
}
