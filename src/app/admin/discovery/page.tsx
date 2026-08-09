"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";

const ADMIN_SECRET_HEADER = "x-admin-secret";

const TRIPMATCH_TAGS = [
  { key: "coffee_carts", label: "☕ עגלות קפה" }, { key: "nature_trails", label: "🌿 מסלולי טבע" },
  { key: "beaches_pools", label: "🏖️ חופים/בריכות" }, { key: "viewpoints", label: "🌅 תצפיות" },
  { key: "parks_picnic", label: "🌳 פארקים" }, { key: "water_parks", label: "🎡 פארקי מים" },
  { key: "attractions", label: "🎯 אטרקציות" }, { key: "sports_extreme", label: "🚴 ספורט" },
  { key: "restaurants", label: "🍽️ מסעדות" }, { key: "wineries", label: "🍷 יקבים" },
  { key: "culture_museums", label: "🏛️ תרבות" }, { key: "shopping", label: "🛍️ שופינג" },
  { key: "events", label: "🎪 אירועים" }, { key: "nightlife", label: "🎭 חיי לילה" },
  { key: "spa", label: "🧖 ספא" }, { key: "boating", label: "🛶 שיט" },
  { key: "heritage", label: "🛕 מורשת" }, { key: "kids_family", label: "👨‍👩‍👧‍👦 ילדים" },
  { key: "art_galleries", label: "🎨 אמנות" }, { key: "photo_spots", label: "📸 צילום" },
];

const DNA_TAGS = [
  { key: "romantic", label: "רומנטי" }, { key: "family", label: "משפחתי" }, { key: "social", label: "חברתי" },
  { key: "luxury", label: "יוקרתי" }, { key: "local_authentic", label: "מקומי" }, { key: "touristy", label: "תיירותי" },
  { key: "special", label: "מיוחד" }, { key: "photogenic", label: "פוטוגני" }, { key: "adventurous", label: "הרפתקני" },
  { key: "natural", label: "טבעי" }, { key: "urban", label: "עירוני" }, { key: "cultural", label: "תרבותי" },
  { key: "culinary", label: "קולינרי" }, { key: "wellness_calm", label: "רגוע" }, { key: "active", label: "אקטיבי" },
  { key: "hidden_gem", label: "פנינה נסתרת" },
];

interface Place {
  id: string;
  name: string;
  short_description: string | null;
  city: string | null;
  country: string | null;
  rating: number | null;
  image_urls: string[];
  category: string;
  kosher: boolean | null;
  accessible: boolean | null;
  tripmatch_scores: Record<string, number>;
  dna_scores: Record<string, number>;
}

interface Destination {
  id: string;
  name: string;
  country: string | null;
}

export default function DiscoveryPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [freeText, setFreeText] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [resultErrors, setResultErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!adminSecret) return;
    fetch("/api/admin/destinations", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => setDestinations(data.destinations ?? []))
      .catch(() => {});
  }, [adminSecret]);

  const countries = Array.from(new Set(destinations.map((d) => d.country).filter(Boolean))) as string[];
  const citiesForCountry = destinations.filter((d) => !country || d.country === country);

  async function handleSearch() {
    if (!freeText.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery-jobs/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ freeText, country, city }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults((prev) => [...(data.places ?? []), ...prev]);
      setResultErrors(data.errors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "החיפוש נכשל");
    } finally {
      setSearching(false);
    }
  }

  async function toggleField(placeId: string, field: "kosher" | "accessible", current: boolean | null) {
    const next = current === true ? null : true;
    setResults((prev) => prev.map((p) => (p.id === placeId ? { ...p, [field]: next } : p)));
    await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
      body: JSON.stringify({ [field]: next }),
    });
  }

  async function toggleScore(placeId: string, scoreField: "tripmatch_scores" | "dna_scores", tagKey: string, current: Record<string, number>) {
    const isOn = (current[tagKey] ?? 0) > 0;
    const next = { ...current };
    if (isOn) delete next[tagKey];
    else next[tagKey] = 100;
    setResults((prev) => prev.map((p) => (p.id === placeId ? { ...p, [scoreField]: next } : p)));
    await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
      body: JSON.stringify({ [scoreField]: next }),
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          הוספת מקומות ואטרקציות
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          כתוב בקשה חופשית, או הדבק רשימה מוכנה - Claude מבין את שניהם, גוגל מאמת כל מקום
        </p>
      </div>

      {/* שורת החיפוש */}
      <div className="max-w-3xl rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
        <div className="grid grid-cols-2 gap-3">
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
              placeholder="לא חובה"
            />
            <datalist id="discovery-countries">
              {countries.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </AdminField>
          <AdminField label="עיר / יעד">
            <input
              list="discovery-cities"
              className={adminInputClass}
              style={adminInputStyle}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="לא חובה - מהרשימה או הקלדה חופשית"
            />
            <datalist id="discovery-cities">
              {citiesForCountry.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </AdminField>
        </div>

        <div className="mt-3">
          <AdminField label="מה לחפש? (בקשה חופשית, או רשימה מוכנה שכתבת/הדבקת)">
            <textarea
              className={adminInputClass}
              style={{ ...adminInputStyle, minHeight: 90 }}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder='לדוגמה: "100 עגלות קפה בתל אביב" או הדבקת רשימה שלמה עם תיאורים'
            />
          </AdminField>
        </div>

        <div className="mt-3">
          <AdminButton onClick={handleSearch} disabled={searching || !freeText.trim()}>
            {searching ? "מחפש ומאמת מול גוגל... (יכול לקחת זמן)" : "🔍 חפש והוסף"}
          </AdminButton>
        </div>
        {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
      </div>

      {resultErrors.length > 0 && (
        <div className="max-w-3xl rounded-[var(--admin-radius-sm)] p-3" style={{ background: "#FEF3C7" }}>
          <ul className="flex flex-col gap-1 text-[12px]" style={{ color: "#92400E" }}>
            {resultErrors.map((e, i) => (
              <li key={i}>⚠️ {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* תוצאות - כרטיס לכל מקום, עם תגיות לחיצות */}
      <div className="flex flex-col gap-4">
        {results.map((place) => (
          <div key={place.id} className="rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
            <div className="flex gap-4">
              {place.image_urls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={place.image_urls[0]} alt="" className="h-20 w-20 shrink-0 rounded-[var(--admin-radius-md)] object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                  {place.name}
                </p>
                <p className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                  {[place.city, place.country].filter(Boolean).join(", ")} {place.rating ? `· ⭐ ${place.rating}` : ""}
                </p>
                {place.short_description && (
                  <p className="mt-1 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                    {place.short_description}
                  </p>
                )}
              </div>
            </div>

            {/* צ'יפים כלליים */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TagChip active={place.kosher === true} onClick={() => toggleField(place.id, "kosher", place.kosher)}>
                כשר
              </TagChip>
              <TagChip active={place.accessible === true} onClick={() => toggleField(place.id, "accessible", place.accessible)}>
                נגיש
              </TagChip>
            </div>

            {/* 20 תגיות TripMatch */}
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold" style={{ color: "#548235" }}>
                TripMatch
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TRIPMATCH_TAGS.map((t) => (
                  <TagChip
                    key={t.key}
                    active={(place.tripmatch_scores?.[t.key] ?? 0) > 0}
                    onClick={() => toggleScore(place.id, "tripmatch_scores", t.key, place.tripmatch_scores ?? {})}
                    color="#548235"
                  >
                    {t.label}
                  </TagChip>
                ))}
              </div>
            </div>

            {/* DNA */}
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold" style={{ color: "#BF8F00" }}>
                DNA
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DNA_TAGS.map((t) => (
                  <TagChip
                    key={t.key}
                    active={(place.dna_scores?.[t.key] ?? 0) > 0}
                    onClick={() => toggleScore(place.id, "dna_scores", t.key, place.dna_scores ?? {})}
                    color="#BF8F00"
                  >
                    {t.label}
                  </TagChip>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagChip({ children, active, onClick, color = "var(--admin-accent)" }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
      style={{
        borderColor: active ? color : "var(--admin-border)",
        background: active ? `${color}22` : "var(--admin-bg)",
        color: active ? color : "var(--admin-ink-secondary)",
      }}
    >
      {children}
    </button>
  );
}
