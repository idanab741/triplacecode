"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { getAvatarUrl } from "@/constants/avatar";
import { ensureConversation, sendSharedMessage, type ShareTarget } from "@/services/social/dmService";

interface Friend {
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
 * שיתוף תוכן (פוסט / מקום) לחברים באפליקציה: בוחרים חבר אחד או יותר, מוסיפים הערה אופציונלית,
 * וההודעה נשלחת לצ'אט הפרטי של כל אחד מהם כשהיא מוצגת שם ככרטיס לחיץ.
 * כשיש יותר מאפשרות אחת (למשל פוסט שמקושר למקום) - בורר בראש הגיליון.
 */
export function ShareToFriendsSheet({ options, onClose }: { options: ShareOption[]; onClose: () => void }) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [optionIndex, setOptionIndex] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/social/friends")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const list = ((data.friends ?? []) as { friend: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null }[])
          .filter((row) => row.friend)
          .map((row) => ({
            id: row.friend!.id,
            username: row.friend!.username,
            fullName: row.friend!.full_name,
            avatarUrl: row.friend!.avatar_url,
          }));
        setFriends(list);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setFriends([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends ?? [];
    return (friends ?? []).filter((f) => `${f.fullName ?? ""} ${f.username ?? ""}`.toLowerCase().includes(q));
  }, [friends, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    const target = options[optionIndex].target;
    let ok = 0;
    for (const friendId of selected) {
      try {
        const conversation = await ensureConversation(friendId);
        await sendSharedMessage(conversation.id, target, note);
        ok += 1;
      } catch {
        // ממשיכים לשאר החברים - מדווחים בסוף כמה נשלחו
      }
    }
    setSending(false);
    if (ok === 0) {
      setError("השליחה נכשלה - נסו שוב.");
      return;
    }
    if (ok < selected.size) setError(`נשלח ל-${ok} מתוך ${selected.size} חברים.`);
    setSentCount(ok);
  }

  const footer =
    sentCount == null ? (
      <div className="flex flex-col gap-2 px-1 pb-1">
        {error && <p className="text-center text-[12.5px] text-danger">{error}</p>}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הוסיפו הודעה (לא חובה)..."
          className="w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
        />
        <button
          type="button"
          disabled={selected.size === 0 || sending}
          onClick={handleSend}
          className="w-full rounded-pill py-3 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--color-places-violet), var(--color-places-purple))" }}
        >
          {sending ? "שולחים..." : selected.size > 0 ? `שליחה (${selected.size})` : "בחרו חברים לשליחה"}
        </button>
      </div>
    ) : undefined;

  return (
    <BottomSheet onClose={onClose} footer={footer}>
      <h2 className="mb-3 text-[17px] font-bold text-ink">שליחה לחברים</h2>

      {sentCount != null ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-places-purple text-[22px] text-white">✓</span>
          <p className="text-[15px] font-bold text-ink">{sentCount === 1 ? "נשלח לחבר אחד" : `נשלח ל-${sentCount} חברים`}</p>
          {error && <p className="text-[12.5px] text-ink-secondary">{error}</p>}
          <button type="button" onClick={onClose} className="rounded-pill px-6 py-2 text-[14px] font-bold text-places-purple">
            סגירה
          </button>
        </div>
      ) : (
        <>
          {options.length > 1 && (
            <div className="mb-3 flex rounded-pill bg-bg-secondary p-1">
              {options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setOptionIndex(i)}
                  className={`flex-1 rounded-pill py-1.5 text-[13px] font-bold transition ${i === optionIndex ? "bg-white text-ink shadow-soft" : "text-ink-secondary"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש חבר..."
            className="mb-2 w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
          />

          {friends === null && (
            <div className="flex flex-col gap-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-card bg-bg-secondary" />
              ))}
            </div>
          )}
          {friends !== null && filtered.length === 0 && (
            <p className="py-8 text-center text-[13.5px] text-ink-secondary">
              {loadError ? "לא הצלחנו לטעון את החברים" : query ? "לא נמצאו חברים" : "עוד אין לכם חברים באפליקציה - הוסיפו חברים כדי לשתף איתם."}
            </p>
          )}
          <ul className="max-h-[45vh] overflow-y-auto overscroll-contain">
            {filtered.map((f) => {
              const isSelected = selected.has(f.id);
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => toggle(f.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-start transition active:bg-black/[0.04]">
                    <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getAvatarUrl(f.avatarUrl)} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold text-ink">{f.fullName ?? f.username ?? "מטייל"}</span>
                      {f.fullName && f.username && <span className="block truncate text-[12px] text-ink-secondary">@{f.username}</span>}
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[13px] text-white transition ${
                        isSelected ? "border-places-purple bg-places-purple" : "border-black/15"
                      }`}
                      aria-hidden
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}
