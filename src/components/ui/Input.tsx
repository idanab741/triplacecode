import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** אייקון המוצג בצד ההתחלה של השדה (ימין, כי האתר RTL). */
  icon?: ReactNode;
}

export function Input({ icon, className = "", ...props }: InputProps) {
  return (
    <div className="relative w-full">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-ink-secondary">
          {icon}
        </span>
      )}
      <input
        className={`w-full rounded-card border border-ink-secondary/25 bg-bg py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          icon ? "ps-11 pe-4" : "px-4"
        } ${className}`}
        {...props}
      />
    </div>
  );
}
