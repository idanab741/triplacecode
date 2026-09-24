"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * חלקי UI משותפים לעמודי היצירה (פוסט / מקום / חוויות / טיול) - אותה שפה כמו שאר עמודי
 * האפליקציה הפנימיים ("הבחירות שלי", "מה חדש?"): רקע לבן, טקסט חד, כחול האפליקציה
 * לבחירה/הדגשה, משטחים אפורים-בהירים במקום מסגרות. הכפתור הראשי הוא תמיד components/ui/Button.
 */

export const CREATE_BLUE = "#0A6DFE";
export const CREATE_INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

/** שדה טקסט בשורה אחת. */
export const FIELD_CLASS =
  "h-12 w-full rounded-full bg-[#F1F2F5] px-4 text-[15px] text-ink placeholder:text-[#9aa1ad] focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30";
/** שדה טקסט רב-שורתי. */
export const TEXTAREA_CLASS =
  "w-full resize-none rounded-[20px] bg-[#F1F2F5] p-4 text-[15px] leading-relaxed text-ink placeholder:text-[#9aa1ad] focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30";

/** כותרת עמוד יצירה + שורת הסבר. */
export function CreatePageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-secondary">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-semibold text-ink">
      {children}
    </label>
  );
}

export function OptionalTag() {
  return <span className="font-normal text-ink-secondary">(לא חובה)</span>;
}

export function ErrorBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={`mt-3 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13px] font-medium text-[#C8373C] ${className}`}>
      {children}
    </p>
  );
}

export function ActionIcon({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={dark ? { background: "rgba(94,200,255,0.14)", color: "#7CC8FF" } : { background: "rgba(10,109,254,0.1)", color: CREATE_BLUE }}
    >
      {children}
    </span>
  );
}

/** שורת פעולה בכרטיס אפור-בהיר (הוספת מדיה / תיוג מקום / הוספת פריט...). */
export function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
  dark = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-start transition disabled:opacity-45 ${
        dark ? "bg-white/[0.06] active:bg-white/10" : "bg-[#F7F8FA] active:bg-[#EFF1F4]"
      }`}
    >
      <ActionIcon dark={dark}>{icon}</ActionIcon>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${dark ? "text-white" : "text-ink"}`}>{title}</span>
        {subtitle && <span className={`block text-[12.5px] ${dark ? "text-white/55" : "text-ink-secondary"}`}>{subtitle}</span>}
      </span>
      <span className={dark ? "text-white/30" : "text-[#b3b9c3]"}>
        <ChevronIcon />
      </span>
    </button>
  );
}

/** שדה חיפוש עם זכוכית מגדלת. */
export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
  dark = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  dark?: boolean;
}) {
  return (
    <label
      className={`flex h-12 items-center gap-2.5 rounded-full px-4 focus-within:ring-2 ${
        dark ? "bg-white/10 text-white/50 focus-within:ring-white/20" : "bg-[#F1F2F5] text-ink-secondary focus-within:ring-[#0A6DFE]/30"
      }`}
    >
      <SearchIcon />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-full min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none ${
          dark ? "text-white placeholder:text-white/40" : "text-ink placeholder:text-[#9aa1ad]"
        }`}
      />
    </label>
  );
}

/** שלד טעינה לשורות רשימה (תמונה + שתי שורות טקסט). */
export function RowSkeletons({ count = 3, dark = false }: { count?: number; dark?: boolean }) {
  const a = dark ? "bg-white/10" : "bg-[#EFF1F4]";
  const b = dark ? "bg-white/[0.06]" : "bg-[#F4F5F7]";
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <span className={`h-12 w-12 shrink-0 animate-pulse rounded-[14px] ${a}`} />
          <span className="flex flex-1 flex-col gap-2">
            <span className={`h-3.5 w-2/3 animate-pulse rounded ${a}`} />
            <span className={`h-3 w-1/3 animate-pulse rounded ${b}`} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────── אייקונים (קו, currentColor) ───────────── */

export function Svg({ children, size = 18, strokeWidth = 2 }: { children: ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export function SearchIcon() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Svg>
  );
}
export function PinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}
export function PlaneIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </Svg>
  );
}
export function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
export function ImageIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 15.5-4.5-4.5L6 19.5" />
    </Svg>
  );
}
export function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z" />
    </Svg>
  );
}
export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}
export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size} strokeWidth={2.4}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}
/** חץ "קדימה" ב-RTL (מצביע שמאלה). */
export function ChevronIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}
export function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  );
}
export function FriendsIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Svg>
  );
}
export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}
export function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </svg>
  );
}
