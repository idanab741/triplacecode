"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  icon?: ReactNode;
}

/** רשימה נפתחת עם שדה חיפוש לסינון האפשרויות. */
export function Select({ value, onChange, options, placeholder, icon }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((option) => option.includes(query.trim()));

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-card border border-ink-secondary/25 bg-bg px-4 py-3 text-start text-sm text-ink"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-ink-secondary">{icon}</span>}
          <span className={value ? "text-ink" : "text-ink-secondary"}>
            {value || placeholder}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-hidden rounded-card border border-ink-secondary/15 bg-bg shadow-soft">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש..."
            className="w-full border-b border-ink-secondary/15 px-4 py-2 text-sm text-ink placeholder:text-ink-secondary focus:outline-none"
          />
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-2 text-sm text-ink-secondary">לא נמצאו תוצאות</li>
            )}
            {filtered.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full px-4 py-2 text-start text-sm hover:bg-bg-secondary ${
                    option === value ? "font-semibold text-accent" : "text-ink"
                  }`}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
