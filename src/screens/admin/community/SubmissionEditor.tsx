"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AdminSubmission, SubmissionPatch } from "@/services/admin/insights/submissions";
import { useAdminFetch } from "@/screens/admin/kit/useAdminData";
import { Button, Pill } from "@/screens/admin/kit/ui";
import { Icon } from "@/screens/admin/kit/Icon";
import { timeAgo } from "@/screens/admin/kit/format";
import { TRIPADD_SUBCATEGORIES } from "@/constants/tripAddSubcategories";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="admin-skeleton h-[280px]" />,
});

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface Draft {
  name: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  description: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  website: string;
  phone: string;
  googlePlaceId: string;
}

const toDraft = (s: AdminSubmission): Draft => ({
  name: s.name,
  category: s.category,
  subcategory: s.subcategory ?? "",
  shortDescription: s.shortDescription ?? "",
  description: s.description ?? "",
  city: s.city ?? "",
  address: s.address ?? "",
  latitude: s.latitude,
  longitude: s.longitude,
  website: s.website ?? "",
  phone: s.phone ?? "",
  googlePlaceId: s.googlePlaceId ?? "",
});

/** מחשב רק את השדות שהשתנו - כדי לא לדרוס שדות שלא נגענו בהם. */
function diff(original: Draft, draft: Draft): SubmissionPatch {
  const patch: SubmissionPatch = {};
  const textKeys = ["name", "category", "subcategory", "shortDescription", "description", "city", "address", "website", "phone", "googlePlaceId"] as const;
  for (const k of textKeys) {
    if (original[k].trim() !== draft[k].trim()) (patch as Record<string, string>)[k] = draft[k];
  }
  if (original.latitude !== draft.latitude || original.longitude !== draft.longitude) {
    patch.latitude = draft.latitude;
    patch.longitude = draft.longitude;
  }
  return patch;
}

const inputCls = "w-full rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none focus:border-[var(--admin-accent)]";
const inputStyle = { background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function SubmissionEditor({
  submission,
  categories,
  onClose,
  onSaved,
}: {
  submission: AdminSubmission;
  categories: { value: string; label: string }[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const request = useAdminFetch();
  const original = useMemo(() => toDraft(submission), [submission]);
  const [draft, setDraft] = useState<Draft>(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const patch = diff(original, draft);
  const dirty = Object.keys(patch).length > 0;
  const locationChanged = patch.latitude !== undefined;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  useEffect(() => {
    const q = geoQuery.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(async () => {
      try {
        const body = await request<{ suggestions: Suggestion[] }>(`/api/admin/insights/geo?q=${encodeURIComponent(q)}`);
        setSuggestions(body.suggestions);
      } catch (err) {
        setGeoNote(err instanceof Error ? err.message : "החיפוש נכשל");
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [geoQuery, request]);

  async function pickSuggestion(s: Suggestion) {
    setGeoBusy(true);
    setSuggestions([]);
    setGeoQuery("");
    try {
      const d = await request<{ placeId: string; name: string; address: string; city: string | null; latitude: number; longitude: number }>(
        `/api/admin/insights/geo?placeId=${encodeURIComponent(s.placeId)}`
      );
      setDraft((cur) => ({
        ...cur,
        latitude: d.latitude,
        longitude: d.longitude,
        address: d.address ?? cur.address,
        city: d.city ?? cur.city,
        googlePlaceId: d.placeId,
      }));
      setGeoNote(`המיקום עודכן ל-"${d.name}"`);
    } catch (err) {
      setGeoNote(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setGeoBusy(false);
    }
  }

  async function movePin(lat: number, lng: number) {
    const rlat = Math.round(lat * 1e7) / 1e7;
    const rlng = Math.round(lng * 1e7) / 1e7;
    setDraft((cur) => ({ ...cur, latitude: rlat, longitude: rlng }));
    setGeoNote("הסיכה הוזזה - מאתר כתובת...");
    try {
      const res = await fetch(`/api/places/reverse-geocode?lat=${rlat}&lng=${rlng}`);
      const body = (await res.json()) as { address_text?: string; city?: string | null; error?: string };
      if (!res.ok || !body.address_text) {
        setGeoNote("המיקום עודכן. לא נמצאה כתובת אוטומטית - אפשר להקליד ידנית.");
        return;
      }
      setDraft((cur) => ({ ...cur, address: body.address_text ?? cur.address, city: body.city ?? cur.city }));
      setGeoNote(`המיקום עודכן · כתובת: ${body.address_text}`);
    } catch {
      setGeoNote("המיקום עודכן. לא נמצאה כתובת אוטומטית.");
    }
  }

  async function save(approve: boolean) {
    setSaving(true);
    setError(null);
    try {
      await request(`/api/admin/insights/submissions/${submission.kind}/${submission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ patch, approve }),
      });
      onSaved(approve ? `"${draft.name}" נשמר ואושר` : `השינויים ב-"${draft.name}" נשמרו`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  const subcategoryOptions =
    submission.kind === "tripadd" ? (TRIPADD_SUBCATEGORIES[draft.category as TripAddCategory] ?? []).flatMap((g) => g.tags) : [];
  const photos = [...submission.photos, ...(submission.googlePhotoUrl ? [submission.googlePhotoUrl] : [])];

  // Portal לשורש האדמין: המגירה מכסה את כל המסך ולא נכלאת בתוך הכרטיס, ועדיין יורשת את משתני העיצוב
  const portalTarget = typeof document !== "undefined" ? document.querySelector(".admin-root") : null;
  const overlay = (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/45" onMouseDown={() => !saving && onClose()}>
      <aside
        className="admin-fade-in admin-scrollbar flex h-full w-full max-w-[640px] flex-col overflow-y-auto"
        style={{ background: "var(--admin-bg)", boxShadow: "var(--admin-shadow-lg)" }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`עריכת ${submission.name}`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-5 py-4" style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" }}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-[17px] font-semibold">עריכת הצעה</h2>
              <Pill tone="accent">{submission.kind === "tripadd" ? "TripAdd" : "הצעת מקום"}</Pill>
              <Pill tone={submission.status === "approved" ? "success" : submission.status === "rejected" ? "danger" : "warning"}>
                {submission.status === "approved" ? "מאושר" : submission.status === "rejected" ? "נדחה" : "ממתין"}
              </Pill>
            </div>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              נשלח ע״י {submission.submittedBy} · {timeAgo(submission.createdAt)}
              {submission.status === "approved" && submission.kind === "tripadd" && " · מוצג במפה - שינויים יופיעו מיד"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[var(--admin-radius-sm)] p-1.5" style={{ color: "var(--admin-ink-secondary)" }} aria-label="סגור">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 p-5">
          {photos.length > 0 && (
            <div className="admin-scrollbar flex gap-2 overflow-x-auto pb-1">
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-28 w-28 rounded-[var(--admin-radius-md)] object-cover" />
                </a>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-3 rounded-[var(--admin-radius-lg)] border p-4" style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" }}>
            <h3 className="flex items-center gap-2 text-[14px] font-semibold">
              <Icon name="place" size={16} style={{ color: "var(--admin-accent)" }} />
              מיקום
              {locationChanged && <Pill tone="warning">שונה - לא נשמר עדיין</Pill>}
            </h3>
            <div className="relative">
              <Icon name="search" size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }} />
              <input
                value={geoQuery}
                onChange={(e) => {
                  setGeoQuery(e.target.value);
                  if (e.target.value.trim().length < 2) setSuggestions([]);
                }}
                placeholder='חפשו את המקום הנכון ב-Google (למשל "חוף הצוק")'
                className={`${inputCls} pr-9`}
                style={inputStyle}
              />
              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-[1000] mt-1 overflow-hidden rounded-[var(--admin-radius-sm)] border" style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-md)" }}>
                  {suggestions.slice(0, 6).map((s) => (
                    <li key={s.placeId}>
                      <button type="button" onClick={() => pickSuggestion(s)} className="flex w-full flex-col px-3 py-2 text-right hover:bg-[var(--admin-bg-surface-hover)]">
                        <span className="text-[13px] font-medium">{s.mainText}</span>
                        <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                          {s.secondaryText}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <LocationPickerMap latitude={draft.latitude} longitude={draft.longitude} onChange={movePin} />
            <p className="text-[12px]" style={{ color: geoBusy ? "var(--admin-accent)" : "var(--admin-ink-secondary)" }}>
              {geoBusy ? "טוען מיקום..." : (geoNote ?? "גררו את הסיכה או לחצו על המפה כדי לתקן את המיקום")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="כתובת">
                <input value={draft.address} onChange={(e) => set("address", e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="עיר">
                <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="קו רוחב (lat)">
                <input
                  dir="ltr"
                  type="number"
                  step="any"
                  value={draft.latitude ?? ""}
                  onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value))}
                  className={`${inputCls} admin-num`}
                  style={{ ...inputStyle, textAlign: "left", direction: "ltr" }}
                />
              </Field>
              <Field label="קו אורך (lng)">
                <input
                  dir="ltr"
                  type="number"
                  step="any"
                  value={draft.longitude ?? ""}
                  onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value))}
                  className={`${inputCls} admin-num`}
                  style={{ ...inputStyle, textAlign: "left", direction: "ltr" }}
                />
              </Field>
            </div>
            {locationChanged && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  icon="refresh"
                  onClick={() => {
                    setDraft((d) => ({ ...d, latitude: original.latitude, longitude: original.longitude, address: original.address, city: original.city, googlePlaceId: original.googlePlaceId }));
                    setGeoNote(null);
                  }}
                >
                  החזר למיקום המקורי
                </Button>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--admin-radius-lg)] border p-4" style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" }}>
            <h3 className="flex items-center gap-2 text-[14px] font-semibold">
              <Icon name="tag" size={16} style={{ color: "var(--admin-accent)" }} />
              פרטים
            </h3>
            <Field label="שם המקום">
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="קטגוריה">
                <select
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value, subcategory: submission.kind === "tripadd" && e.target.value !== d.category ? "" : d.subcategory }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="תת-קטגוריה">
                <input list={`subcats-${submission.id}`} value={draft.subcategory} onChange={(e) => set("subcategory", e.target.value)} className={inputCls} style={inputStyle} />
                {subcategoryOptions.length > 0 && (
                  <datalist id={`subcats-${submission.id}`}>
                    {subcategoryOptions.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                )}
              </Field>
            </div>
            <Field label="תיאור קצר">
              <input value={draft.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="תיאור / המלצת המשתמש">
              <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputCls} style={inputStyle} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="אתר">
                <input dir="ltr" value={draft.website} onChange={(e) => set("website", e.target.value)} className={inputCls} style={{ ...inputStyle, textAlign: "left", direction: "ltr" }} />
              </Field>
              <Field label="טלפון">
                <input dir="ltr" value={draft.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} style={{ ...inputStyle, textAlign: "left", direction: "ltr" }} />
              </Field>
            </div>
          </section>

          {error && (
            <p className="flex items-center gap-2 rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
              <Icon name="alertCircle" size={15} />
              {error}
            </p>
          )}
        </div>

        <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3" style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" }}>
          <span className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
            {dirty ? `${Object.keys(patch).length - (patch.longitude !== undefined ? 1 : 0)} שדות שונו` : "אין שינויים"}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button variant={submission.status === "pending" ? "secondary" : "primary"} icon="check" disabled={saving || !dirty} onClick={() => save(false)}>
              {saving ? "שומר..." : "שמור"}
            </Button>
            {submission.status === "pending" && (
              <Button variant="primary" icon="checkCircle" disabled={saving} onClick={() => save(true)}>
                {dirty ? "שמור ואשר" : "אשר"}
              </Button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
  return portalTarget ? createPortal(overlay, portalTarget) : overlay;
}
