"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { AddPlaceModal, type AddModalContext } from "@/screens/admin/place-console/AddPlaceModal";

const ADMIN_SECRET_HEADER = "x-admin-secret";
const PREVIEW_COUNT = 6;

interface SectionPlace {
  id: string;
  name: string;
  city: string | null;
  category: string;
  subcategory: string | null;
  imageUrls: string[];
  rating: number | null;
}

/**
 * עמוד יעד "חופשה בארץ" - Structure B (ר' דרישה מפורשת #10): סקשני
 * קטגוריה חיים סביב היעד הזה (רדיוס geo, בדיוק כמו destination/[slug]
 * באפליקציה עצמה - אין DB חדש, אין "edition" ליבא/ליצור). כל סקשן
 * נטען בנפרד (אותו /api/admin/discovery-sections הקיים, רק עם lat/lng)
 * כדי לשמור על אותה שכבת שירות בדיוק שהאפליקציה משתמשת בה.
 */
export default function DomesticDestinationPage() {
  const { secret: adminSecret } = useAdminSecret();
  const params = useParams();
  const slug = params.slug as string;

  const destination = ISRAEL_VACATION_DESTINATIONS.find((d) => d.slug === slug);
  const sections = ADMIN_DISCOVERY_SECTIONS.weekend ?? [];

  const [placesBySection, setPlacesBySection] = useState<Record<string, SectionPlace[] | undefined>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [addModalContext, setAddModalContext] = useState<AddModalContext | null>(null);

  useEffect(() => {
    if (!adminSecret || !destination) return;
    setPlacesBySection({});
    setExpandedSections(new Set());
    setError(null);

    sections.forEach((section) => {
      const params = new URLSearchParams({
        quickCategory: "weekend",
        sectionId: section.id,
        lat: String(destination.lat),
        lng: String(destination.lng),
      });
      fetch(`/api/admin/discovery-sections?${params.toString()}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setPlacesBySection((prev) => ({ ...prev, [section.id]: data.places ?? [] }));
        })
        .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת אטרקציות"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret, slug, refreshTick]);

  function toggleExpand(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  if (!destination) {
    return (
      <div dir="rtl" className="p-6">
        <p style={{ color: "var(--admin-danger)" }}>יעד לא נמצא.</p>
      </div>
    );
  }

  const totalPlaces = (Object.values(placesBySection) as (SectionPlace[] | undefined)[]).reduce((sum, list) => sum + (list?.length ?? 0), 0);

  return (
    <div dir="rtl" className="admin-fade-in flex flex-col gap-6 p-6">
      {/* Breadcrumbs */}
      <p className="text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>
        <Link href="/admin/place-console" className="hover:underline">
          סוגי טיול
        </Link>
        {" / "}
        <Link href="/admin/place-console" className="hover:underline">
          חופשה בארץ
        </Link>
        {" / "}
        <span style={{ color: "var(--admin-ink)" }}>{destination.name}</span>
      </p>

      <div className="flex items-center gap-4">
        {destination.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={destination.imageUrl} alt={destination.name} className="h-20 w-28 shrink-0 rounded-[var(--admin-radius-md)] object-cover" />
        )}
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            🇮🇱 {destination.name}
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {sections.length} קטגוריות · {totalPlaces} אטרקציות
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-[var(--admin-radius-md)] px-4 py-3 text-[13.5px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      {/* סקשני קטגוריה - שם + ספירה + גריד + "ראה הכל" */}
      <div className="flex flex-col gap-8">
        {sections.map((section) => {
          const places = placesBySection[section.id];
          const isExpanded = expandedSections.has(section.id);
          const visiblePlaces = places ? (isExpanded ? places : places.slice(0, PREVIEW_COUNT)) : [];

          return (
            <div key={section.id}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                  {section.emoji} {section.title}
                  <span className="mr-2 text-[12.5px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>
                    {places ? `· ${places.length}` : ""}
                  </span>
                </h2>
                {places && places.length > PREVIEW_COUNT && (
                  <button type="button" onClick={() => toggleExpand(section.id)} className="text-[12.5px] font-medium" style={{ color: "var(--admin-accent)" }}>
                    {isExpanded ? "הצג פחות" : "ראה הכל"}
                  </button>
                )}
              </div>

              {places === undefined ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="admin-skeleton aspect-[3/4] rounded-[var(--admin-radius-md)]" />
                  ))}
                </div>
              ) : places.length === 0 ? (
                <p className="text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                  אין עדיין אטרקציות מסווגות ל&quot;{section.title}&quot; ליד {destination.name}.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {visiblePlaces.map((place) => (
                    <Link
                      key={place.id}
                      href={`/admin/places/${place.id}`}
                      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[var(--admin-radius-md)] border transition hover:opacity-95"
                      style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" }}
                    >
                      {place.imageUrls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={place.imageUrls[0]} alt={place.name} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: "var(--admin-ink-faint)" }}>
                          🖼️
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2 pt-8">
                        <p className="truncate text-[12.5px] font-bold leading-tight text-white">{place.name}</p>
                        <p className="truncate text-[10.5px] text-white/75">
                          {place.city ?? ""}
                          {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {/* "+" - context-aware: יעד + סקשן שמור. אין geo/city
                      נוסף ב-context - הסינון הגאוגרפי כבר קורה טבעית
                      (Google מגיע עם lat/lng אמיתיים ליד היעד; בחירת
                      מקום קיים כנראה כבר רלוונטי גאוגרפית) - ה-+ רק
                      מוסיף את הסיווג הטקסונומי (trip_type_tags/
                      subcategory) שקובע הופעה בסקשן הזה בפועל. */}
                  <button
                    type="button"
                    onClick={() =>
                      setAddModalContext({
                        quickCategory: "weekend",
                        quickCategoryLabel: QUICK_CATEGORY_LABELS.weekend,
                        sectionId: section.id,
                        sectionTitle: `${section.title} - ${destination.name}`,
                      })
                    }
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[var(--admin-radius-md)] border-2 border-dashed transition hover:opacity-80"
                    style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
                  >
                    <span className="text-2xl">+</span>
                    <span className="px-2 text-center text-[11px] font-medium leading-tight">הוסף ל{section.title}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addModalContext && (
        <AddPlaceModal context={addModalContext} adminSecret={adminSecret} onClose={() => setAddModalContext(null)} onAdded={() => setRefreshTick((t) => t + 1)} />
      )}
    </div>
  );
}
