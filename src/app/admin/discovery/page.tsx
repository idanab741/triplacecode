"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { DISCOVERY_TRIP_TYPES, type DiscoveryFilterOption } from "@/services/admin/discoveryConfig";

const ADMIN_SECRET_HEADER = "x-admin-secret";
const QUANTITY_OPTIONS = [10, 20, 50, 100, 250, 500, 1000];

/** מסך ה-AI Discovery - השלב הראשון בבנייה מחדש לפי המפרט: בחירת סוג
 *  טיול → קטגוריות רלוונטיות בלבד → פילטרים רלוונטיים בלבד → כמות →
 *  הפעלה. זהו ה-UI; המנוע האמיתי מאחורי "הפעל חיפוש" (Google Discovery
 *  + Duplicate Detection + AI Enrichment + TripMatch Classification) הוא
 *  הפאזה הבאה - כרגע יוצר Discovery Job ברשומה, לא מריץ אותו בפועל. */
export default function DiscoveryWizardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [tripTypeKey, setTripTypeKey] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(20);
  const [minRating, setMinRating] = useState(4.0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripType = DISCOVERY_TRIP_TYPES.find((t) => t.key === tripTypeKey) ?? null;

  function toggleCategory(key: string) {
    setSelectedCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function updateFilter(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLaunch() {
    if (!tripType) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          tripType: tripType.key,
          categories: selectedCategories,
          filters: filterValues,
          quantity,
          minRating,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/admin/discovery-jobs/${data.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת החיפוש נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          🤖 מצא מקומות באמצעות AI
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          בחר סוג טיול → בחר מה לחפש → בחר איפה → הגדר איכות → הגדר כמות → לחץ מצא
        </p>
      </div>

      {/* שלב 1 - סוג טיול */}
      <div className="grid grid-cols-4 gap-3 md:grid-cols-7">
        {DISCOVERY_TRIP_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTripTypeKey(t.key);
              setSelectedCategories([]);
              setFilterValues({});
              setStep(2);
            }}
            className="flex flex-col items-center gap-2 rounded-[var(--admin-radius-lg)] border p-4 text-center transition"
            style={{
              borderColor: tripTypeKey === t.key ? "var(--admin-accent)" : "var(--admin-border)",
              background: tripTypeKey === t.key ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
            }}
          >
            <span className="text-[26px]">{t.emoji}</span>
            <span className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {tripType && (
        <>
          {/* שלב 2 - קטגוריות (רק של סוג הטיול שנבחר) */}
          <div>
            <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
              מה בא לכם לחפש?
            </h2>
            <div className="flex flex-wrap gap-2">
              {tripType.categories.map((c) => {
                const selected = selectedCategories.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCategory(c.key)}
                    className="rounded-full border px-3.5 py-2 text-[13px] font-medium transition"
                    style={{
                      borderColor: selected ? "var(--admin-accent)" : "var(--admin-border)",
                      background: selected ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
                      color: selected ? "var(--admin-accent)" : "var(--admin-ink)",
                    }}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* שלב 3 - פילטרים (רק של סוג הטיול שנבחר, דינמי) */}
          {selectedCategories.length > 0 && (
            <div>
              <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                פילטרים
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {tripType.filters.map((f) => (
                  <DiscoveryFilterField key={f.key} filter={f} value={filterValues[f.key] ?? ""} onChange={(v) => updateFilter(f.key, v)} />
                ))}
              </div>
            </div>
          )}

          {/* שלב 4 - איכות + כמות */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap items-end gap-6 rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
              <AdminField label="דירוג Google מינימלי">
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={5}
                  className={adminInputClass}
                  style={{ ...adminInputStyle, width: 100 }}
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                />
              </AdminField>
              {minRating < 4 && (
                <p className="text-[12.5px] text-amber-600">⚠️ מתחת ל-4.0 - מקומות מתחת ל-3.0 עדיין ידרשו אישור ידני תמיד</p>
              )}
              <AdminField label="כמה מקומות למצוא?">
                <div className="flex flex-wrap gap-1.5">
                  {QUANTITY_OPTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className="rounded-[var(--admin-radius-sm)] border px-3 py-1.5 text-[12.5px] font-medium"
                      style={{
                        borderColor: quantity === q ? "var(--admin-accent)" : "var(--admin-border)",
                        background: quantity === q ? "var(--admin-accent-soft)" : "transparent",
                        color: quantity === q ? "var(--admin-accent)" : "var(--admin-ink)",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminButton onClick={handleLaunch} disabled={submitting}>
                {submitting ? "מפעיל..." : "🔍 הפעל חיפוש"}
              </AdminButton>
            </div>
          )}
        </>
      )}

      {error && <p className="text-[13.5px] text-red-600">{error}</p>}
    </div>
  );
}

function DiscoveryFilterField({ filter, value, onChange }: { filter: DiscoveryFilterOption; value: string; onChange: (v: string) => void }) {
  if (filter.type === "toggle") {
    return (
      <AdminField label={filter.label}>
        <select className={adminInputClass} style={adminInputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">לא משנה</option>
          <option value="true">כן</option>
          <option value="false">לא</option>
        </select>
      </AdminField>
    );
  }
  if ((filter.type === "select" || filter.type === "multiselect") && filter.options) {
    return (
      <AdminField label={filter.label}>
        <select className={adminInputClass} style={adminInputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">הכל</option>
          {filter.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </AdminField>
    );
  }
  return (
    <AdminField label={filter.label}>
      <input className={adminInputClass} style={adminInputStyle} value={value} onChange={(e) => onChange(e.target.value)} />
    </AdminField>
  );
}
