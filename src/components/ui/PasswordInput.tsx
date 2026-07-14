"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./Input";

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 5.1A9.4 9.4 0 0 1 12 5c5 0 9 4.5 9 7-.6 1.2-1.5 2.5-2.7 3.6M6.7 6.7C4.6 8 3.2 9.7 3 12c1 2 3 4.5 6 5.6" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** שדה סיסמה עם אייקון מנעול וכפתור הצג/הסתר אמיתי. */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      icon={<LockIcon />}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        >
          <EyeIcon open={visible} />
        </button>
      }
    />
  );
}
