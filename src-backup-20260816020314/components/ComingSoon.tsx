import { Screen } from "@/components/ui";

interface ComingSoonProps {
  title: string;
  message?: string;
}

/** מסך "בקרוב" מעוצב, לשימוש בתכונות שעדיין לא נבנו. */
export function ComingSoon({ title, message = "הפיצ'ר הזה בדרך אלינו, ממש בקרוב!" }: ComingSoonProps) {
  return (
    <Screen>
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-secondary text-3xl">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-start)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="max-w-xs text-sm text-ink-secondary">{message}</p>
      </div>
    </Screen>
  );
}
