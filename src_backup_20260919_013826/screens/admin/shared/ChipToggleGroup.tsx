"use client";

/** קבוצת "צ'יפים" לבחירה מרובה - מחליף checkbox+label גולמיים בקומפוננטה
 *  אחת קומפקטית וברורה. משמש לתגיות סוג מסלול, מטבח, עונות, גילאי ילדים. */
export function ChipToggleGroup({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition"
            style={{
              borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
              background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
              color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** בורר תלת-מצבי (כן / לא / לא ידוע) - לשדות כמו "כשר", "נגישות". */
export function TriStateToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const options: { label: string; value: boolean | null }[] = [
    { label: "כן", value: true },
    { label: "לא", value: false },
    { label: "לא ידוע", value: null },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-[var(--admin-radius-sm)] border" style={{ borderColor: "var(--admin-border)" }}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 text-[12px] font-medium transition"
          style={{
            background: value === opt.value ? "var(--admin-accent)" : "transparent",
            color: value === opt.value ? "#fff" : "var(--admin-ink-secondary)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
