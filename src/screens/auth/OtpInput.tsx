"use client";

import { useRef } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export function OtpInput({ value, onChange, length = 8 }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function updateDigit(index: number, char: string) {
    const clean = char.replace(/\D/g, "");
    const nextDigits = [...digits];
    nextDigits[index] = clean.slice(-1) ?? "";
    onChange(nextDigits.join(""));
    if (clean && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent, index: number) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    const nextDigits = [...digits];
    for (let i = 0; i < pasted.length && index + i < length; i++) {
      nextDigits[index + i] = pasted[i];
    }
    onChange(nextDigits.join(""));
    const lastFilled = Math.min(index + pasted.length, length - 1);
    refs.current[lastFilled]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-1.5" dir="ltr">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={(e) => handlePaste(e, i)}
          className="h-12 w-9 rounded-card border border-ink-secondary/25 bg-bg text-center text-lg font-bold text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      ))}
    </div>
  );
}
