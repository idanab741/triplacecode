"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
        style={{ borderRadius: "18px", borderBottomRightRadius: "5px" }}
      >
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50" />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
