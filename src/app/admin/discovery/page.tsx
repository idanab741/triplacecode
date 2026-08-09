"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { DISCOVERY_BUCKETS } from "@/services/admin/discoveryConfigV2";

const ADMIN_SECRET_HEADER = "x-admin-secret";
const QUANTITY_OPTIONS = [10, 20, 50, 100, 250, 500, 1000];

interface Destination {
  id: string;
  name: string;
  country: string | null;
}

/** מסך AI Discovery, גרסה 2 - נבנה מחדש לפי בקשה מפורשת: מיקום קודם
 *  (מדינה -> עיר, מתוך רשימת היעדים המתוירת שכבר קיימת + "אחר" חופשי,
 *  אף אחד לא חובה), ואז 4 אפשרויות פשוטות (מסעדה/אטרקציות/חיי לילה/לינה)
 *  במקום 7 סוגי טיול - כל אחת פותחת את מה שכבר קיים לה. */
export default function DiscoveryWizardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [useOtherCity, setUseOtherCity] = useState(false);
  const [otherCity, setOtherCity] = useState("");

  const [bucketKey, setBucketKey] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(0);
  const [budget, setBudget] = useState("");
  const [quantity, setQuantity] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminSecret) return;
    fetch("/api/admin/destinations", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => setDestinations(data.destinations ?? []))
      .catch(() => {});
  }, [adminSecret]);

  const countries = Array.from(new Set(destinations.map((d) => d.country).filter(Boolean))) as string[];
  const citiesForCountry = destinations.filter((d) => !country || d.country === country);
  const bucket = DISCOVERY_BUCKETS.find((b) => b.key === bucketKey) ?? null;

  function toggleCategory(key: string) {
    setSelectedCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleLaunch() {
    if (!bucket) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          tripType: bucket.key,
          categories: selectedCategories,
          filters: {
            country,
            city: useOtherCity ? otherCity : city,
            budget,
          },
          quantity,
          minRating,
          minReviews,
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
          מיקום → מה מחפשים → פילטרים → הפעל
        </p>
      </div>

      {/* שלב 1 - מיקום: מדינה + עיר. שום דבר כאן לא חובה. */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          איפה? (לא חובה)
        </h2>
        <div className="grid max-w-2xl grid-cols-2 gap-4">
          <AdminField label="מדינה">
            <input
              list="discovery-countries"
              className={adminInputClass}
              style={adminInputStyle}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setCity("");
              }}
              placeholder="לדוגמה: ישראל"
            />
            <datalist id="discovery-countries">
              {countries.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </AdminField>

          {!useOtherCity ? (
            <AdminField label="עיר / יעד">
              <select className={adminInputClass} style={adminInputStyle} value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">— לא הוגדר —</option>
                {citiesForCountry.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </AdminField>
          ) : (
            <AdminField label="עיר / יעד (הזנה חופשית)">
              <input className={adminInputClass} style={adminInputStyle} value={otherCity} onChange={(e) => setOtherCity(e.target.value)} placeholder="הקלד שם יעד" />
            </AdminField>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUseOtherCity((v) => !v)}
          className="mt-2 text-[12.5px] font-medium"
          style={{ color: "var(--admin-accent)" }}
        >
          {useOtherCity ? "← בחר מתוך הרשימה" : "אחר (יעד לא ברשימה)"}
        </button>
      </div>

      {/* שלב 2 - 4 האפשרויות */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          מה מחפשים?
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {DISCOVERY_BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setBucketKey(b.key);
                setSelectedCategories([]);
              }}
              className="flex flex-col items-center gap-2 rounded-[var(--admin-radius-lg)] border p-5 text-center transition"
              style={{
                borderColor: bucketKey === b.key ? "var(--admin-accent)" : "var(--admin-border)",
                background: bucketKey === b.key ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
              }}
            >
              <span className="text-[30px]">{b.emoji}</span>
              <span className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
                {b.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* שלב 3 - קטגוריות ספציפיות לאפשרות שנבחרה, בתיבה עם מסגרת */}
      {bucket && (
        <div
          className="rounded-[var(--admin-radius-lg)] border p-5"
          style={{ borderColor: "var(--admin-accent)", background: "var(--admin-bg-surface)" }}
        >
          <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            {bucket.emoji} {bucket.label} - איזה סוג?
          </h2>
          <div className="flex flex-wrap gap-2">
            {bucket.categories.map((c) => {
              const selected = selectedCategories.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCategory(c.key)}
                  className="rounded-full border px-3.5 py-2 text-[13px] font-medium transition"
                  style={{
                    borderColor: selected ? "var(--admin-accent)" : "var(--admin-border)",
                    background: selected ? "var(--admin-accent-soft)" : "var(--admin-bg)",
                    color: selected ? "var(--admin-accent)" : "var(--admin-ink)",
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* שלב 4 - פילטרים + הפעלה */}
      {bucket && selectedCategories.length > 0 && (
        <div className="flex flex-wrap items-end gap-6 rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
          <AdminField label="דירוג Google מינימלי">
            <input type="number" step="0.1" min={1} max={5} className={adminInputClass} style={{ ...adminInputStyle, width: 90 }} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} />
          </AdminField>
          <AdminField label="מספר ביקורות מינימלי">
            <input type="number" min={0} className={adminInputClass} style={{ ...adminInputStyle, width: 100 }} value={minReviews} onChange={(e) => setMinReviews(Number(e.target.value))} />
          </AdminField>
          <AdminField label="תקציב">
            <input className={adminInputClass} style={{ ...adminInputStyle, width: 110 }} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="לא חובה" />
          </AdminField>
          {minRating < 4 && <p className="text-[12.5px] text-amber-600">⚠️ מתחת ל-4.0</p>}
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

      {error && <p className="text-[13.5px] text-red-600">{error}</p>}
    </div>
  );
}
