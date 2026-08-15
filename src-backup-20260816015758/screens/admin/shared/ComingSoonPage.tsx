import { EmptyState } from "./Primitives";

/** מסך "בקרוב" למודולים שטרם נבנו - Empty State מעוצב אמיתי (לא ריק סתם),
 *  עם הסבר קצר על מה בדיוק יהיה במסך הזה, כדי שהניווט ירגיש שלם כבר עכשיו. */
export function ComingSoonPage({ title, description, points }: { title: string; description: string; points: string[] }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          {title}
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          {description}
        </p>
      </div>

      <EmptyState
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 4v5" />
          </svg>
        }
        title="המודול הזה בבנייה"
        description="נבנה בסבב עבודה הבא. הניווט, המבנה והנתיב כבר מוכנים - נשאר רק לחבר את המסך עצמו."
      />

      <div className="rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
          מה יהיה כאן
        </p>
        <ul className="flex flex-col gap-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--admin-ink-faint)" }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
