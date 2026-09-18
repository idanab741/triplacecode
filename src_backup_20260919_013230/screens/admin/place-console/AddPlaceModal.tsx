"use client";

import { useEffect, useState } from "react";
import { AdminField, AdminButton, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES, type PlaceCategoryKey } from "@/constants/placeCategories";
import type { QuickCategoryId } from "@/constants/quickCategories";

const ADMIN_SECRET_HEADER = "x-admin-secret";

/**
 * *** מקור אמת יחיד ל"הוספת מקום context-aware" (דרישה מפורשת #27 -
 * "אין ליצור עוד מערכת סינון נפרדת... פונקציה מרכזית"). משותף בין
 * /admin/place-console (חו״ל + sections), /admin/place-console/[id]
 * (עמוד יעד חו״ל) ו-/admin/place-console/domestic/[slug] (חופשה בארץ) -
 * שלושתם קוראים לאותו AddPlaceModal, לא משכפלים אותו.
 */
export interface AddModalContext {
  quickCategory: QuickCategoryId;
  quickCategoryLabel: string;
  sectionId: string;
  sectionTitle: string;
  country?: string;
}

/** בונה מה-context (סוג טיול + סקשן + מדינה) בדיוק את השדות שצריך
 *  לעדכן כדי שהמקום *באמת* יסווג לסקשן הזה - אותה טקסונומיה בדיוק
 *  שקובעת מה מוצג (ADMIN_DISCOVERY_SECTIONS), לא ניחוש. ר' דרישה
 *  מפורשת #19 - "אין לבצע הוספה כללית שאחר כך מצריכה מה-ADMIN לנחש". */
function buildClassificationPatch(context: AddModalContext) {
  const section = ADMIN_DISCOVERY_SECTIONS[context.quickCategory]?.find((s) => s.id === context.sectionId);
  const patch: Record<string, unknown> = {};
  const addToArray: Record<string, string> = {};

  if (section?.categoryColumnEquals) {
    patch.category = section.categoryColumnEquals;
  } else {
    const fallback = QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES[context.quickCategory];
    if (fallback?.length) patch.category = fallback[0] as PlaceCategoryKey;
  }

  const groupIds = section?.categories ?? (section?.category ? [section.category] : []);
  if (groupIds.length > 0) addToArray.trip_type_tags = groupIds[0];
  if (section?.subcategories?.length) patch.subcategory = section.subcategories[0];
  if (section?.requiredAnyTags?.length) addToArray.tags = section.requiredAnyTags[0];
  if (section?.requiredAnyCuisineTags?.length) addToArray.cuisine_tags = section.requiredAnyCuisineTags[0];
  if (context.country) patch.country = context.country;

  return { patch, addToArray, sectionTitle: section?.title ?? context.sectionTitle };
}

interface ExistingPlaceResult {
  id: string;
  name: string;
  city: string | null;
  category: string;
  trip_type_tags?: string[] | null;
  tags?: string[] | null;
  cuisine_tags?: string[] | null;
  image_urls?: string[] | null;
}

function AddPlaceModal({ context, adminSecret, onClose, onAdded }: { context: AddModalContext; adminSecret: string; onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingPlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || tab !== "existing") {
      setResults(null);
      return;
    }
    let ignore = false;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/places?q=${encodeURIComponent(query.trim())}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
        .then((res) => res.json())
        .then((data) => {
          if (ignore) return;
          setResults((data.places ?? []).slice(0, 20));
        })
        .catch(() => !ignore && setResults([]))
        .finally(() => !ignore && setSearching(false));
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [query, tab, adminSecret]);

  async function applyToExisting(place: ExistingPlaceResult) {
    setApplyingId(place.id);
    setError(null);
    try {
      const { patch, addToArray, sectionTitle } = buildClassificationPatch(context);
      const body: Record<string, unknown> = { ...patch };
      if (addToArray.trip_type_tags) body.trip_type_tags = Array.from(new Set([...(place.trip_type_tags ?? []), addToArray.trip_type_tags]));
      if (addToArray.tags) body.tags = Array.from(new Set([...(place.tags ?? []), addToArray.tags]));
      if (addToArray.cuisine_tags) body.cuisine_tags = Array.from(new Set([...(place.cuisine_tags ?? []), addToArray.cuisine_tags]));

      const res = await fetch(`/api/admin/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "העדכון נכשל");
      setSuccessMessage(`"${place.name}" סווג בהצלחה ל"${sectionTitle}"`);
      onAdded();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "העדכון נכשל");
    } finally {
      setApplyingId(null);
    }
  }

  async function handleCreateNew() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const createRes = await fetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "יצירת המקום נכשלה");

      const { patch, addToArray, sectionTitle } = buildClassificationPatch(context);
      const body: Record<string, unknown> = { ...patch };
      if (addToArray.trip_type_tags) body.trip_type_tags = [addToArray.trip_type_tags];
      if (addToArray.tags) body.tags = [addToArray.tags];
      if (addToArray.cuisine_tags) body.cuisine_tags = [addToArray.cuisine_tags];

      const patchRes = await fetch(`/api/admin/places/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(body),
      });
      const patchedData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchedData.error ?? "סיווג המקום נכשל (המקום נוצר אך לא סווג)");

      setSuccessMessage(`"${created.name}" נוצר וסווג בהצלחה ל"${sectionTitle}"`);
      onAdded();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת המקום נכשלה");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--admin-radius-lg)] border"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-4" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            הוספה ל{context.sectionTitle}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
            {context.quickCategoryLabel} ← {context.sectionTitle}
            {context.country ? ` ← ${context.country}` : ""}
          </p>
        </div>

        <div className="flex gap-1 border-b px-4 pt-2" style={{ borderColor: "var(--admin-border)" }}>
          <button
            type="button"
            onClick={() => setTab("existing")}
            className="px-3 py-2 text-[13px] font-medium"
            style={{ color: tab === "existing" ? "var(--admin-accent)" : "var(--admin-ink-secondary)", borderBottom: tab === "existing" ? "2px solid var(--admin-accent)" : "2px solid transparent" }}
          >
            מקום קיים
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className="px-3 py-2 text-[13px] font-medium"
            style={{ color: tab === "new" ? "var(--admin-accent)" : "var(--admin-ink-secondary)", borderBottom: tab === "new" ? "2px solid var(--admin-accent)" : "2px solid transparent" }}
          >
            מקום חדש
          </button>
        </div>

        <div className="admin-scrollbar flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-[var(--admin-radius-sm)] p-2.5 text-[12.5px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
              {error}
            </p>
          )}
          {successMessage && (
            <p className="mb-3 rounded-[var(--admin-radius-sm)] p-2.5 text-[12.5px]" style={{ background: "var(--admin-success-soft)", color: "var(--admin-success)" }}>
              ✓ {successMessage}
            </p>
          )}

          {tab === "existing" ? (
            <div className="flex flex-col gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש מקום קיים במאגר (שם/עיר)..."
                className={adminInputClass}
                style={adminInputStyle}
                autoFocus
              />
              {searching && <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>מחפש...</p>}
              {results && results.length === 0 && !searching && (
                <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                  לא נמצאו מקומות תואמים - נסו את &quot;מקום חדש&quot;.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                {(results ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyToExisting(p)}
                    disabled={applyingId === p.id}
                    className="flex items-center justify-between rounded-[var(--admin-radius-sm)] border px-3 py-2 text-right text-[13px] transition hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
                  >
                    <span>
                      {p.name} <span style={{ color: "var(--admin-ink-faint)" }}>{p.city ? `· ${p.city}` : ""}</span>
                    </span>
                    <span style={{ color: "var(--admin-accent)" }}>{applyingId === p.id ? "מסווג..." : "בחר +"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AdminField label="שם המקום (ייחפש ויאותר אוטומטית ב-Google, כולל תמונה ופרטים)">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="לדוגמה: קפה גרג תל אביב" className={adminInputClass} style={adminInputStyle} autoFocus />
              </AdminField>
              <AdminButton onClick={handleCreateNew} disabled={!newName.trim() || creating}>
                {creating ? "יוצר ומסווג..." : `צור והוסף ל${context.sectionTitle}`}
              </AdminButton>
            </div>
          )}
        </div>

        <div className="border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
          <AdminButton variant="secondary" onClick={onClose}>
            סגור
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
export { AddPlaceModal };
