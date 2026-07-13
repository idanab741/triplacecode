import Link from "next/link";

/** שורת חיפוש שמנווטת ל-/search (עדיין ללא חיפוש אמיתי). */
export function SearchBarLink() {
  return (
    <Link
      href="/search"
      className="mx-6 flex items-center gap-2 rounded-pill border border-ink-secondary/15 bg-bg px-4 py-3 text-sm text-ink-secondary shadow-soft"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      מה תרצו לעשות היום?
    </Link>
  );
}
