"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";

const BUCKETS = [
  { key: "attractions", emoji: "🎯", label: "אטרקציות" },
  { key: "nature", emoji: "🌿", label: "טבע" },
  { key: "nightlife", emoji: "🌃", label: "חיי לילה" },
  { key: "restaurants", emoji: "🍽️", label: "מסעדות" },
  { key: "hotels", emoji: "🏨", label: "מלונות" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

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

const CUISINE_TAGS = [
  { key: "coffee_cart", label: "☕ עגלת קפה" }, { key: "israeli", label: "🥙 ישראלי" },
  { key: "italian", label: "🍝 איטלקי" }, { key: "asian", label: "🥢 אסייתי" },
  { key: "bbq", label: "🍖 בשרים ועל האש" }, { key: "burger_diner", label: "🍔 המבורגר ודיינר" },
  { key: "mexican", label: "🌮 מקסיקני" }, { key: "greek", label: "🫓 יווני" },
  { key: "french_bistro", label: "🥖 ביסטרו צרפתי" }, { key: "indian", label: "🍛 הודי" },
  { key: "mediterranean", label: "🫒 ים-תיכוני" }, { key: "seafood", label: "🐟 דגים ופירות ים" },
  { key: "pizza", label: "🍕 פיצה" }, { key: "brunch", label: "🥐 בראנץ'" },
  { key: "cafe", label: "☕ בית קפה" }, { key: "chef_restaurant", label: "👨‍🍳 מסעדת שף" },
  { key: "desserts", label: "🍰 מתוקים" },
];

const OTHER_CATEGORY_TAGS = [
  // אטרקציות
  { key: "nature_trails", label: "🌿 מסלולי טבע" }, { key: "beaches_pools", label: "🏖️ חופים/בריכות" },
  { key: "viewpoints", label: "🌅 תצפיות" }, { key: "parks_picnic", label: "🌳 פארקים" },
  { key: "water_parks", label: "🎡 פארקי מים" }, { key: "general_attractions", label: "🎯 אטרקציות" },
  { key: "sports_extreme", label: "🚴 ספורט/אקסטרים" }, { key: "wineries", label: "🍷 יקבים" },
  { key: "culture_museums", label: "🏛️ תרבות/מוזיאונים" }, { key: "shopping", label: "🛍️ שופינג" },
  { key: "events", label: "🎪 אירועים" }, { key: "spa", label: "🧖 ספא" },
  { key: "boating", label: "🛶 שיט" }, { key: "heritage", label: "🛕 מורשת" },
  { key: "kids_family", label: "👨‍👩‍👧‍👦 ילדים ומשפחות" }, { key: "art_galleries", label: "🎨 אמנות" },
  { key: "photo_spots", label: "📸 צילום" }, { key: "must_see_landmarks", label: "🗽 אתר חובה" },
  // חיי לילה
  { key: "cocktail_bar", label: "🍸 בר קוקטיילים" }, { key: "wine_bar", label: "🍷 בר יין" },
  { key: "club", label: "🎧 מועדון" }, { key: "live_show", label: "🎤 הופעה חיה" },
  { key: "standup", label: "🎭 סטנדאפ" }, { key: "theater", label: "🎙️ תיאטרון" },
  { key: "karaoke", label: "🎤 קריוקי" }, { key: "bowling", label: "🎳 באולינג" },
  { key: "snooker", label: "🎱 סנוקר" }, { key: "arcade", label: "🕹️ ארקייד" },
  // לינה
  { key: "hotel", label: "🏨 מלון" }, { key: "resort", label: "🏝️ ריזורט" },
  { key: "apartment", label: "🏠 דירה" }, { key: "cabin", label: "🛖 צימר" },
  { key: "hostel", label: "🛏️ הוסטל" }, { key: "camping", label: "⛺ קמפינג" },
  { key: "glamping", label: "🏕️ גלמפינג" }, { key: "villa", label: "🏡 וילה" },
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
  cuisine_tags: string[];
  tags: string[];
}

interface Destination {
  id: string;
  name: string;
  country: string | null;
}

export default function DiscoveryPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [bucket, setBucket] = useState<BucketKey>("attractions");
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
    if (!country.trim() && !city.trim()) {
      setError("חובה למלא מדינה או עיר/יעד (לפחות אחד מהשניים)");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery-jobs/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ freeText, country, city, bucket }),
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

  const [fillingAi, setFillingAi] = useState<string | null>(null);
  const [fillingAll, setFillingAll] = useState(false);
  const [fillAllProgress, setFillAllProgress] = useState(0);

  async function handleAiFillOne(placeId: string): Promise<void> {
    const res = await fetch(`/api/admin/places/${placeId}/suggest-scores`, {
      method: "POST",
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    });
    const data = await res.json();
    if (data.place) {
      setResults((prev) => prev.map((p) => (p.id === placeId ? data.place : p)));
    }
  }

  async function handleAiFill(placeId: string) {
    setFillingAi(placeId);
    try {
      await handleAiFillOne(placeId);
    } catch {
      // שקט - לא חוסם, המשתמש עדיין יכול למלא ידנית
    } finally {
      setFillingAi(null);
    }
  }

  async function handleAiFillAll() {
    setFillingAll(true);
    setFillAllProgress(0);
    // ברצף, לא Promise.all - כדי לא להציף את Claude/למנוע חריגה ממגבלת קצב
    for (let i = 0; i < results.length; i++) {
      try {
        await handleAiFillOne(results[i].id);
      } catch {
        // ממשיכים לבא בתור גם אם אחד נכשל
      }
      setFillAllProgress(i + 1);
    }
    setFillingAll(false);
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

  async function toggleArrayTag(placeId: string, field: "cuisine_tags" | "tags", tagKey: string, current: string[]) {
    const isOn = current.includes(tagKey);
    const next = isOn ? current.filter((t) => t !== tagKey) : [...current, tagKey];
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

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-md)]"
            style={{ background: "var(--admin-accent-soft)" }}
          >
            🔍
          </span>
          הוספת מקומות ואטרקציות
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          כתוב בקשה חופשית, או הדבק רשימה מוכנה - Claude מבין את שניהם, גוגל מאמת כל מקום
        </p>
      </div>

      {/* 5 קטגוריות ראשיות */}
      <div className="grid grid-cols-5 gap-3">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className="flex flex-col items-center gap-2 rounded-[var(--admin-radius-lg)] border py-4 transition"
            style={{
              borderColor: bucket === b.key ? "var(--admin-accent)" : "var(--admin-border)",
              background: bucket === b.key ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
              boxShadow: bucket === b.key ? "var(--admin-shadow-sm)" : undefined,
            }}
          >
            <span className="text-[24px]">{b.emoji}</span>
            <span className="text-[13px] font-semibold" style={{ color: bucket === b.key ? "var(--admin-accent)" : "var(--admin-ink)" }}>
              {b.label}
            </span>
          </button>
        ))}
      </div>

      {/* שורת החיפוש */}
      <div
        className="max-w-3xl rounded-[var(--admin-radius-lg)] border p-5"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)", boxShadow: "var(--admin-shadow-sm)" }}
      >
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
              placeholder="לפחות אחד מהשניים"
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
              placeholder="מהרשימה או הקלדה חופשית"
            />
            <datalist id="discovery-cities">
              {citiesForCountry.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </AdminField>
        </div>

        <div className="mt-3">
          <AdminField label={`מה לחפש? (בקשה חופשית, או רשימה שהדבקת - ${BUCKETS.find((b) => b.key === bucket)?.label})`}>
            <textarea
              className={adminInputClass}
              style={{ ...adminInputStyle, minHeight: 90 }}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder='לדוגמה: "100 עגלות קפה בתל אביב" או הדבקת רשימה שלמה עם תיאורים'
            />
          </AdminField>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <AdminButton onClick={handleSearch} disabled={searching || !freeText.trim()}>
            {searching ? "מחפש ומאמת מול גוגל..." : "🔍 חפש והוסף"}
          </AdminButton>
          {searching && (
            <span className="text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
              יכול לקחת כמה שניות - בודקים כל מקום מול Google
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
      </div>

      {resultErrors.length > 0 && (
        <div className="max-w-3xl rounded-[var(--admin-radius-md)] p-3" style={{ background: "var(--admin-warning-soft)" }}>
          <ul className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--admin-warning)" }}>
            {resultErrors.map((e, i) => (
              <li key={i}>⚠️ {e}</li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
            {results.length} תוצאות
          </p>
          <AdminButton variant="secondary" onClick={handleAiFillAll} disabled={fillingAll}>
            {fillingAll ? `✨ ממלא... (${fillAllProgress}/${results.length})` : `✨ מלא הכל עם AI (${results.length})`}
          </AdminButton>
        </div>
      )}

      {/* תוצאות */}
      <div className="grid grid-cols-2 gap-4">
        {results.map((place) => {
          const activeCounts = {
            tripmatch: (Object.values(place.tripmatch_scores ?? {}) as number[]).filter((v) => v > 0).length,
            dna: (Object.values(place.dna_scores ?? {}) as number[]).filter((v) => v > 0).length,
            cuisine: place.cuisine_tags?.length ?? 0,
            category: place.tags?.length ?? 0,
          };
          const totalActive = activeCounts.tripmatch + activeCounts.dna + activeCounts.cuisine + activeCounts.category;
          const expanded = expandedCards.has(place.id);

          return (
            <div
              key={place.id}
              className="flex flex-col overflow-hidden rounded-[var(--admin-radius-lg)] border"
              style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)", boxShadow: "var(--admin-shadow-sm)" }}
            >
              <div className="flex gap-3 p-4">
                {place.image_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={place.image_urls[0]} alt="" className="h-16 w-16 shrink-0 rounded-[var(--admin-radius-md)] object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)]" style={{ background: "var(--admin-bg-sunken)" }}>
                    📍
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                    {place.name}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                    {[place.city, place.country].filter(Boolean).join(", ")}
                    {place.rating ? ` · ⭐ ${place.rating}` : ""}
                  </p>
                  {place.short_description && (
                    <p className="mt-1 line-clamp-2 text-[11.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                      {place.short_description}
                    </p>
                  )}
                </div>
              </div>

              {/* פס סטטוס תמציתי - כמה תגיות מכל סוג פעילות, בלי הצפה */}
              <div className="flex items-center gap-1.5 border-t px-4 py-2" style={{ borderColor: "var(--admin-border)" }}>
                <StatusPill label="TripMatch" count={activeCounts.tripmatch} color="#548235" />
                <StatusPill label="DNA" count={activeCounts.dna} color="#BF8F00" />
                <StatusPill label="מטבח" count={activeCounts.cuisine} />
                <StatusPill label="קטגוריה" count={activeCounts.category} />
                {place.kosher === true && <StatusPill label="כשר" count={1} solid />}
                {place.accessible === true && <StatusPill label="נגיש" count={1} solid />}
              </div>

              <div className="flex items-center gap-2 border-t px-4 py-2.5" style={{ borderColor: "var(--admin-border)" }}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(place.id)}
                  className="text-[12.5px] font-medium"
                  style={{ color: "var(--admin-accent)" }}
                >
                  {expanded ? "▲ סגור עריכת תגיות" : `▼ ערוך תגיות (${totalActive} פעילות)`}
                </button>
                <span className="flex-1" />
                <AdminButton variant="secondary" onClick={() => handleAiFill(place.id)} disabled={fillingAi === place.id}>
                  {fillingAi === place.id ? "ממלא..." : "✨ מלא עם AI"}
                </AdminButton>
              </div>

              {expanded && (
                <div className="flex flex-col gap-4 border-t p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" }}>
                  <div className="flex flex-wrap gap-1.5">
                    <TagChip active={place.kosher === true} onClick={() => toggleField(place.id, "kosher", place.kosher)}>
                      כשר
                    </TagChip>
                    <TagChip active={place.accessible === true} onClick={() => toggleField(place.id, "accessible", place.accessible)}>
                      נגיש
                    </TagChip>
                  </div>

                  <TagSection title="מטבח / סגנון קולינרי">
                    {CUISINE_TAGS.map((t) => (
                      <TagChip key={t.key} active={place.cuisine_tags?.includes(t.key) ?? false} onClick={() => toggleArrayTag(place.id, "cuisine_tags", t.key, place.cuisine_tags ?? [])}>
                        {t.label}
                      </TagChip>
                    ))}
                  </TagSection>

                  <TagSection title="קטגוריה / סוג מקום">
                    {OTHER_CATEGORY_TAGS.map((t) => (
                      <TagChip key={t.key} active={place.tags?.includes(t.key) ?? false} onClick={() => toggleArrayTag(place.id, "tags", t.key, place.tags ?? [])}>
                        {t.label}
                      </TagChip>
                    ))}
                  </TagSection>

                  <TagSection title="TripMatch" color="#548235">
                    {TRIPMATCH_TAGS.map((t) => (
                      <TagChip key={t.key} active={(place.tripmatch_scores?.[t.key] ?? 0) > 0} onClick={() => toggleScore(place.id, "tripmatch_scores", t.key, place.tripmatch_scores ?? {})} color="#548235">
                        {t.label}
                      </TagChip>
                    ))}
                  </TagSection>

                  <TagSection title="DNA" color="#BF8F00">
                    {DNA_TAGS.map((t) => (
                      <TagChip key={t.key} active={(place.dna_scores?.[t.key] ?? 0) > 0} onClick={() => toggleScore(place.id, "dna_scores", t.key, place.dna_scores ?? {})} color="#BF8F00">
                        {t.label}
                      </TagChip>
                    ))}
                  </TagSection>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TagSection({ title, color = "var(--admin-ink-secondary)", children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function StatusPill({ label, count, color = "var(--admin-ink-secondary)", solid = false }: { label: string; count: number; color?: string; solid?: boolean }) {
  if (count === 0 && !solid) return null;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: `${color}1a`, color }}
    >
      {label} {!solid && count}
    </span>
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
        background: active ? `${color}22` : "var(--admin-bg-surface)",
        color: active ? color : "var(--admin-ink-secondary)",
      }}
    >
      {children}
    </button>
  );
}
