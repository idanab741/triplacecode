"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

interface DmComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** גובה המקלדת (useKeyboardInset) - כשפתוחה, השורה יושבת צמוד מעליה */
  keyboardInset?: number;
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

/** תיבת הכתיבה הקבועה בתחתית - Enter שולח, Shift+Enter יורד שורה,
 *  מתרחבת אוטומטית עד גובה מקסימלי. אותו רכיב בדיוק כמו SupportComposer,
 *  רק placeholder שונה (שיחה עם אדם, לא עם צוות תמיכה). */
export function DmComposer({ value, onChange, onSend, sending, keyboardInset = 0 }: DmComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // אחרי שליחה השדה מתרוקן - חוזר לגובה שורה אחת
  useEffect(() => {
    if (!value && textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !sending) onSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }

  return (
    // *** בקשה מפורשת ("שורת ההקלדה פתאום צונחת למטה אחרי שמקלידים קצת"): המיקום נגזר מהמקלדת בפועל
    // (visualViewport) ולא מ-bottom קבוע - כך היא נשארת צמודה מעל המקלדת גם כשהדפדפן גולל / השדה גדל.
    <div
      className="fixed inset-x-0 z-50 border-t border-ink-secondary/10 bg-bg-secondary px-5 pb-3 pt-3"
      style={{ bottom: keyboardInset > 0 ? keyboardInset : 96 }}
    >
      <div className="mx-auto flex max-w-md items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="כתבו הודעה..."
          rows={1}
          // לא disabled בזמן שליחה - ב-iOS זה מאבד פוקוס וסוגר את המקלדת אחרי כל הודעה
          className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-card border border-ink-secondary/25 bg-bg px-3.5 py-2.5 text-[16px] leading-6 text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim() || sending}
          aria-label="שליחה"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}
