"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { DataTable, SearchInput, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, DrawerSection, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge, EmptyState } from "@/screens/admin/shared/Primitives";

const ADMIN_SECRET_HEADER = "x-admin-secret";

type FieldType = "number" | "text" | "boolean" | "single_select" | "multi_select";

interface FieldOption {
  value: string;
  label_he: string;
}

interface FieldDef {
  id: string;
  place_type: string;
  field_key: string;
  label_he: string;
  field_type: FieldType;
  options: FieldOption[] | null;
  sort_order: number;
  is_active: boolean;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: "מספר",
  text: "טקסט",
  boolean: "כן/לא",
  single_select: "בחירה יחידה",
  multi_select: "בחירה מרובה",
};

const EMPTY_FORM = {
  place_type: "",
  field_key: "",
  label_he: "",
  field_type: "text" as FieldType,
  optionsText: "", // שורה לכל אפשרות: value|תווית
  sort_order: 0,
};

/** מסך אדמין לניהול מרשם השדות הדינמי (place_type_field_defs) - כאן, ולא
 *  בקוד, נוצרים "סוגי יעד" ו"שדות" חדשים (מסלול טבע, מלון, בר...), בדיוק
 *  לפי הדרישה "בלי צורך בשינוי קוד". ראו migration 0015. */
export default function PlaceTypeFieldsPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // הסיסמה עכשיו מגיעה מ-AdminAuthContext (localStorage משותף לכל
  // עמודי האדמין) - לא צריך יותר sessionStorage נפרד לעמוד הזה.

  async function loadFieldDefs() {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/place-type-fields", {
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "טעינה נכשלה");
      setFieldDefs(data.fieldDefs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFieldDefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  const placeTypes = useMemo(() => {
    const groups = new Map<string, FieldDef[]>();
    for (const def of fieldDefs) {
      if (!groups.has(def.place_type)) groups.set(def.place_type, []);
      groups.get(def.place_type)!.push(def);
    }
    return Array.from(groups.entries())
      .map(([placeType, defs]) => ({ placeType, defs: defs.sort((a, b) => a.sort_order - b.sort_order) }))
      .filter(({ placeType, defs }) => !search || placeType.includes(search) || defs.some((d) => d.label_he.includes(search) || d.field_key.includes(search)))
      .sort((a, b) => a.placeType.localeCompare(b.placeType));
  }, [fieldDefs, search]);

  function openNewField(placeType?: string) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, place_type: placeType ?? "" });
    setDrawerOpen(true);
  }

  function openEditField(def: FieldDef) {
    setEditingId(def.id);
    setForm({
      place_type: def.place_type,
      field_key: def.field_key,
      label_he: def.label_he,
      field_type: def.field_type,
      optionsText: (def.options ?? []).map((o) => `${o.value}|${o.label_he}`).join("\n"),
      sort_order: def.sort_order,
    });
    setDrawerOpen(true);
  }

  function parseOptions(text: string): FieldOption[] | null {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    return lines.map((line) => {
      const [value, label_he] = line.split("|").map((s) => s.trim());
      return { value: value || line, label_he: label_he || value || line };
    });
  }

  async function handleSave() {
    if (!form.place_type.trim() || !form.field_key.trim() || !form.label_he.trim()) {
      setError("יש למלא סוג יעד, מפתח שדה ותווית");
      return;
    }
    setSaving(true);
    setError(null);
    const needsOptions = form.field_type === "single_select" || form.field_type === "multi_select";
    const body = {
      place_type: form.place_type.trim(),
      field_key: form.field_key.trim(),
      label_he: form.label_he.trim(),
      field_type: form.field_type,
      options: needsOptions ? parseOptions(form.optionsText) : null,
      sort_order: form.sort_order,
    };
    try {
      const res = await fetch(
        editingId ? `/api/admin/place-type-fields/${editingId}` : "/api/admin/place-type-fields",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שמירה נכשלה");
      setDrawerOpen(false);
      await loadFieldDefs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(def: FieldDef) {
    try {
      const res = await fetch(`/api/admin/place-type-fields/${def.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ is_active: !def.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "עדכון נכשל");
      await loadFieldDefs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    }
  }

  async function handleDelete(def: FieldDef) {
    if (!confirm(`למחוק לצמיתות את השדה "${def.label_he}"? עדיף לכבות אותו (is_active) אלא אם בטוח שאף יעד לא משתמש בו.`)) return;
    try {
      const res = await fetch(`/api/admin/place-type-fields/${def.id}`, {
        method: "DELETE",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "מחיקה נכשלה");
      await loadFieldDefs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    }
  }

  const columns: Column<FieldDef>[] = [
    { key: "label_he", header: "תווית", render: (d) => (
        <div className="flex items-center gap-2">
          <span style={{ color: d.is_active ? "var(--admin-ink)" : "var(--admin-ink-faint)" }}>{d.label_he}</span>
          {!d.is_active && <Badge tone="neutral">כבוי</Badge>}
        </div>
      ), sortValue: (d) => d.label_he },
    { key: "field_key", header: "מפתח", render: (d) => <span className="admin-mono admin-ltr-value text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>{d.field_key}</span> },
    { key: "field_type", header: "טיפוס", render: (d) => <Badge tone="accent">{FIELD_TYPE_LABELS[d.field_type]}</Badge> },
    { key: "actions", header: "", align: "left", render: (d) => (
        <div className="flex gap-2">
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-accent)" }} onClick={() => openEditField(d)}>עריכה</button>
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }} onClick={() => toggleActive(d)}>{d.is_active ? "כיבוי" : "הפעלה"}</button>
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-danger)" }} onClick={() => handleDelete(d)}>מחיקה</button>
        </div>
      ) },
  ];

  return (
    <div className="admin-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>שדות לפי סוג יעד</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {fieldDefs.length.toLocaleString()} שדות, {placeTypes.length.toLocaleString()} סוגי יעד — מגדיר אילו שדות ייעודיים כל סוג יעד (מסלול טבע, מלון, בר...) מציג בטופס העריכה של "מקומות", בלי צורך בשינוי קוד.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי סוג יעד, תווית או מפתח..." />
        <AdminButton onClick={() => openNewField()}>+ סוג יעד / שדה חדש</AdminButton>
      </div>

      {!adminSecret ? (
        <EmptyState icon={<span>🔒</span>} title="נדרשת סיסמת אדמין" description="הזן את סיסמת האדמין למעלה כדי לטעון את מרשם השדות." />
      ) : loading ? (
        <div className="admin-skeleton h-64 rounded-[var(--admin-radius-lg)]" />
      ) : placeTypes.length === 0 ? (
        <EmptyState
          icon={<span>◫</span>}
          title="אין עדיין סוגי יעד"
          description="לחץ על 'סוג יעד / שדה חדש' כדי ליצור את הראשון."
          action={<AdminButton onClick={() => openNewField()}>+ סוג יעד / שדה חדש</AdminButton>}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {placeTypes.map(({ placeType, defs }) => (
            <div key={placeType} className="rounded-[var(--admin-radius-lg)] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
              <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--admin-border)" }}>
                <div className="flex items-center gap-2">
                  <h2 className="admin-mono admin-ltr-value text-[14.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>{placeType}</h2>
                  <Badge tone="neutral">{defs.length} שדות</Badge>
                </div>
                <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-accent)" }} onClick={() => openNewField(placeType)}>
                  + שדה בסוג הזה
                </button>
              </div>
              <DataTable columns={columns} rows={defs} keyFor={(d) => d.id} emptyMessage="אין שדות" />
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "עריכת שדה" : "שדה חדש"}
        subtitle={editingId ? undefined : "סוג יעד חדש נוצר אוטומטית אם הוא לא קיים עדיין"}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDrawerOpen(false)}>ביטול</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving}>{saving ? "שומר..." : "שמירה"}</AdminButton>
          </>
        }
      >
        <DrawerSection title="זיהוי">
          <AdminField label="סוג יעד (מפתח, לדוגמה: nature_trail)">
            <div className="admin-ltr-value">
              <input
                value={form.place_type}
                onChange={(e) => setForm((f) => ({ ...f, place_type: e.target.value }))}
                placeholder="nature_trail"
                className={adminInputClass}
                style={adminInputStyle}
                disabled={Boolean(editingId)}
              />
            </div>
          </AdminField>
          <AdminField label="מפתח השדה (באנגלית, לדוגמה: trail_length_km)">
            <div className="admin-ltr-value">
              <input
                value={form.field_key}
                onChange={(e) => setForm((f) => ({ ...f, field_key: e.target.value }))}
                placeholder="trail_length_km"
                className={adminInputClass}
                style={adminInputStyle}
                disabled={Boolean(editingId)}
              />
            </div>
          </AdminField>
          <AdminField label="תווית בעברית (מה שיוצג בטופס)">
            <input
              value={form.label_he}
              onChange={(e) => setForm((f) => ({ ...f, label_he: e.target.value }))}
              placeholder="אורך המסלול (ק״מ)"
              className={adminInputClass}
              style={adminInputStyle}
            />
          </AdminField>
        </DrawerSection>

        <DrawerSection title="טיפוס קלט">
          <AdminField label="טיפוס">
            <select
              value={form.field_type}
              onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value as FieldType }))}
              className={adminInputClass}
              style={adminInputStyle}
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </AdminField>

          {(form.field_type === "single_select" || form.field_type === "multi_select") && (
            <AdminField label="אפשרויות (שורה לכל אפשרות: מפתח|תווית)">
              <textarea
                value={form.optionsText}
                onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                placeholder={"easy|קל\nmoderate|בינוני\nchallenging|מאתגר"}
                rows={5}
                className={adminInputClass}
                style={adminInputStyle}
              />
            </AdminField>
          )}

          <AdminField label="סדר תצוגה בטופס">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              className={adminInputClass}
              style={adminInputStyle}
            />
          </AdminField>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
