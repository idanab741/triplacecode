"use client";

import { useState } from "react";
import { AdminButton } from "@/screens/admin/shared/Drawer";
import { ADMIN_DISCOVERY_SECTIONS, type AdminDiscoverySection } from "@/constants/adminDiscoverySections";
import type { QuickCategoryId } from "@/constants/quickCategories";

const ADMIN_SECRET_HEADER = "x-admin-secret";

export interface ClassifyPlace {
  id: string;
  name: string;
  subcategory: string | null;
  tags: string[];
  tripTypeTags: string[];
  cuisineTags: string[];
}

/** האם המקום כבר מסווג לסקשן הזה - כדי לסמן checkbox מראש (בדיוק אותה
 *  לוגיקה כמו matchesAnySection ב-API, לתצוגה בלבד). */
function placeMatchesSection(p: ClassifyPlace, section: AdminDiscoverySection): boolean {
  if (section.categoryColumnEquals) return false; // עמודת category עצמה, לא מסווגים אותה מכאן
  const groupIds = section.categories ?? (section.category ? [section.category] : []);
  const groupMatch = groupIds.length > 0 && groupIds.some((c) => p.tripTypeTags.includes(c));
  const subcatMatch = !!section.subcategories?.length && !!p.subcategory && section.subcategories.includes(p.subcategory);
  const tagMatch = !!section.requiredAnyTags?.length && section.requiredAnyTags.some((t) => p.tags.includes(t));
  const cuisineMatch = !!section.requiredAnyCuisineTags?.length && section.requiredAnyCuisineTags.some((t) => p.cuisineTags.includes(t));
  return groupMatch || subcatMatch || tagMatch || cuisineMatch;
}

/**
 * "כפתור סיווג" - דרישה מפורשת: לכל מקום בתצוגת "הכל" אפשר לפתוח את
 * זה ולבחור ישירות לאילו סקשנים (אחד או יותר) הוא שייך, בלי לעבור
 * דרך חיפוש/יצירה (AddPlaceModal) - זה כבר המקום, רק צריך לסווג אותו.
 * בחירה במספר סקשנים ממזגת את כל השדות הנדרשים (trip_type_tags/tags/
 * cuisine_tags הם arrays - מתווספים; subcategory הוא ערך יחיד - נלקח
 * מהסקשן האחרון שנבחר).
 */
export function ClassifySectionsModal({
  place,
  quickCategory,
  adminSecret,
  onClose,
  onClassified,
}: {
  place: ClassifyPlace;
  quickCategory: QuickCategoryId;
  adminSecret: string;
  onClose: () => void;
  onClassified: () => void;
}) {
  const sections = ADMIN_DISCOVERY_SECTIONS[quickCategory] ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(sections.filter((s) => placeMatchesSection(place, s)).map((s) => s.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(sectionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const chosenSections = sections.filter((s) => selected.has(s.id));
      const tripTypeTags = new Set(place.tripTypeTags);
      const tags = new Set(place.tags);
      const cuisineTags = new Set(place.cuisineTags);
      let subcategory = place.subcategory;

      for (const section of chosenSections) {
        const groupIds = section.categories ?? (section.category ? [section.category] : []);
        groupIds.forEach((g) => tripTypeTags.add(g));
        if (section.subcategories?.length) subcategory = section.subcategories[0];
        section.requiredAnyTags?.forEach((t) => tags.add(t));
        section.requiredAnyCuisineTags?.forEach((t) => cuisineTags.add(t));
      }

      const res = await fetch(`/api/admin/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          trip_type_tags: Array.from(tripTypeTags),
          tags: Array.from(tags),
          cuisine_tags: Array.from(cuisineTags),
          subcategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "עדכון הסיווג נכשל");
      onClassified();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "עדכון הסיווג נכשל");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[var(--admin-radius-lg)] border"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-4" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            סיווג: {place.name}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
            בחרו לאילו סקשנים המקום הזה שייך - אפשר לבחור כמה
          </p>
        </div>

        <div className="admin-scrollbar flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-[var(--admin-radius-sm)] p-2.5 text-[12.5px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => {
              const active = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition"
                  style={{
                    borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
                    background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-sunken)",
                    color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                  }}
                >
                  {s.emoji} {s.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving ? "שומר..." : `שמור סיווג (${selected.size})`}
          </AdminButton>
          <AdminButton variant="secondary" onClick={onClose}>
            ביטול
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
