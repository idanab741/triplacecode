"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./Input";
import { Icon } from "./Icon";

/** ממתין לקובץ eye-slashed.png - עד אז פולבק ל-SVG מוטבע. */
function EyeSlashedFallback() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A9.4 9.4 0 0 1 12 5c5 0 9 4.5 9 7-.6 1.2-1.5 2.5-2.7 3.6M6.7 6.7C4.6 8 3.2 9.7 3 12c1 2 3 4.5 6 5.6" />
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
      icon={<Icon name="lock" size={18} />}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        >
          {visible ? <EyeSlashedFallback /> : <Icon name="eye-open" size={18} />}
        </button>
      }
    />
  );
}
