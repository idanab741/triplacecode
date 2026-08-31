"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTimeHe } from "@/utils/relativeTime";

interface CommentRow {
  id: string;
  text: string;
  created_at: string;
  parent_comment_id: string | null;
  author: { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`/api/social/posts/${id}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setError("שגיאה בטעינת התגובות"));
  }

  useEffect(load, [id]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/social/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PlacesHeader onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto">
        {comments === null && !error && (
          <div className="p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-3 h-12 w-full" />
            ))}
          </div>
        )}
        {error && <PlacesEmptyState title={error} actionLabel="נסה שוב" onAction={load} />}
        {comments?.length === 0 && <PlacesEmptyState title="אין עדיין תגובות - היה הראשון להגיב" />}
        {comments?.map((comment) => (
          <div key={comment.id} className="flex gap-2.5 px-4 py-3">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
              {comment.author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ink-secondary">
                  {comment.author.full_name?.[0] ?? "?"}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-ink">
                <span className="font-bold">{comment.author.full_name ?? comment.author.username}</span> {comment.text}
              </p>
              <span className="text-[11px] text-ink-secondary">{formatRelativeTimeHe(comment.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <div className="flex items-center gap-2 border-t border-ink-secondary/10 px-4 py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="הוסף תגובה..."
            className="flex-1 rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[13.5px] focus:outline-none"
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={handleSend}
            className="rounded-pill px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: "var(--color-places-purple)" }}
          >
            שלח
          </button>
        </div>
      )}
    </div>
  );
}
