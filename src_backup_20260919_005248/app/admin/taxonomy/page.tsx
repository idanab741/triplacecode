"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { DataTable, SearchInput, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, DrawerSection, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge, EmptyState } from "@/screens/admin/shared/Primitives";

const ADMIN_SECRET_HEADER = "x-admin-secret";

interface TaxonomyTerm {
  id: string;
  taxonomy_group: string;
  parent_term_id: string | null;
  value: string;
  label_he: string;
  emoji: string | null;
  image_src: string | null;
  sort_order: number;
  is_active: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  trip_type: "סוגי טיול",
  interest_category: "תחומי עניין (ראשי)",
  interest_subcategory: "תחומי עניין (תת-קטגוריה)",
  cuisine_tag: "תגיות מטבח (מסעדות)",
  culinary_style: "סגנון קולינרי (פרופיל)",
  dietary_restriction: "מגבלות תזונה",
  transportation: "התניידות",
  accommodation_type: "סוגי לינה",
  vacation_preference: "העדפות חופשה בחו״ל",
  season: "עונתיות",
  child_age_band: "טווחי גיל ילדים",
  budget_tier: "רמת תקציב",
  audience_fit: "התאמה לקהל",
  weather_fit: "התאמה למזג אוויר",
  accessibility_feature: "נגישות",
  pet_friendliness_feature: "בעלי חיים",
  place_dna_tag: "Place DNA",
};

const EMPTY_FORM = {
  taxonomy_group: "",
  parent_term_id: "",
  value: "",
  label_he: "",
  emoji: "",
  sort_order: 0,
};

/** מסך אדמין לניהול taxonomy_terms - המילון המרכזי לכל הערכים החוצים סוגי
 *  טיול (ראו migration 0016). זהו הקטלוג בלבד - חיבור צרכנים קיימים
 *  (Onboarding, tripTaxonomy.ts וכו') לקרוא מכאן הוא שלב נפרד ועתידי. */
export default function TaxonomyTermsPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // הסיסמה עכשיו מגיעה מ-AdminAuthContext (localStorage משותף) - לא צריך
  // יותר sessionStorage נפרד לעמוד הזה.

  async function loadTerms() {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/taxonomy-terms", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "טעינה נכשלה");
      setTerms(data.terms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t.taxonomy_group, (counts.get(t.taxonomy_group) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [terms]);

  const termsById = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

  const visibleTerms = useMemo(() => {
    let rows = selectedGroup ? terms.filter((t) => t.taxonomy_group === selectedGroup) : terms;
    if (search) {
      const q = search.trim();
      rows = rows.filter((t) => t.label_he.includes(q) || t.value.includes(q));
    }
    return [...rows].sort((a, b) => {
      const parentA = a.parent_term_id ? (termsById.get(a.parent_term_id)?.sort_order ?? 0) : a.sort_order;
      const parentB = b.parent_term_id ? (termsById.get(b.parent_term_id)?.sort_order ?? 0) : b.sort_order;
      return parentA - parentB || a.sort_order - b.sort_order;
    });
  }, [terms, selectedGroup, search, termsById]);

  function openNewTerm(group?: string) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, taxonomy_group: group ?? selectedGroup ?? "" });
    setDrawerOpen(true);
  }

  function openEditTerm(term: TaxonomyTerm) {
    setEditingId(term.id);
    setForm({
      taxonomy_group: term.taxonomy_group,
      parent_term_id: term.parent_term_id ?? "",
      value: term.value,
      label_he: term.label_he,
      emoji: term.emoji ?? "",
      sort_order: term.sort_order,
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.taxonomy_group.trim() || !form.value.trim() || !form.label_he.trim()) {
      setError("יש למלא קבוצת טקסונומיה, ערך ותווית");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      taxonomy_group: form.taxonomy_group.trim(),
      parent_term_id: form.parent_term_id || null,
      value: form.value.trim(),
      label_he: form.label_he.trim(),
      emoji: form.emoji.trim() || null,
      sort_order: form.sort_order,
    };
    try {
      const res = await fetch(editingId ? `/api/admin/taxonomy-terms/${editingId}` : "/api/admin/taxonomy-terms", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שמירה נכשלה");
      setDrawerOpen(false);
      await loadTerms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(term: TaxonomyTerm) {
    try {
      const res = await fetch(`/api/admin/taxonomy-terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ is_active: !term.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "עדכון נכשל");
      await loadTerms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    }
  }

  async function handleDelete(term: TaxonomyTerm) {
    if (!confirm(`למחוק לצמיתות את "${term.label_he}"? עדיף לכבות (is_active) אלא אם בטוח שהערך לא בשימוש.`)) return;
    try {
      const res = await fetch(`/api/admin/taxonomy-terms/${term.id}`, {
        method: "DELETE",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "מחיקה נכשלה");
      await loadTerms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    }
  }

  const parentOptionsForForm = terms.filter(
    (t) => !t.parent_term_id && (!form.taxonomy_group || t.taxonomy_group !== form.taxonomy_group)
  );

  const columns: Column<TaxonomyTerm>[] = [
    {
      key: "label_he",
      header: "תווית",
      render: (t) => (
        <div className="flex items-center gap-2">
          {t.parent_term_id && <span style={{ color: "var(--admin-ink-faint)" }}>└</span>}
          {t.emoji && <span>{t.emoji}</span>}
          <span style={{ color: t.is_active ? "var(--admin-ink)" : "var(--admin-ink-faint)" }}>{t.label_he}</span>
          {!t.is_active && <Badge tone="neutral">כבוי</Badge>}
        </div>
      ),
      sortValue: (t) => t.label_he,
    },
    {
      key: "value",
      header: "ערך",
      render: (t) => (
        <div className="admin-ltr-value">
          <span className="admin-mono text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>{t.value}</span>
        </div>
      ),
    },
    ...(selectedGroup
      ? []
      : [{ key: "group", header: "קבוצה", render: (t: TaxonomyTerm) => <Badge tone="accent">{GROUP_LABELS[t.taxonomy_group] ?? t.taxonomy_group}</Badge> } as Column<TaxonomyTerm>]),
    {
      key: "actions",
      header: "",
      align: "left",
      render: (t) => (
        <div className="flex gap-2">
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-accent)" }} onClick={() => openEditTerm(t)}>עריכה</button>
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }} onClick={() => toggleActive(t)}>{t.is_active ? "כיבוי" : "הפעלה"}</button>
          <button className="text-[12.5px] font-medium" style={{ color: "var(--admin-danger)" }} onClick={() => handleDelete(t)}>מחיקה</button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>מערכת טקסונומיה</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {terms.length.toLocaleString()} מונחים ב-{groupCounts.length} קבוצות — מקור אחד לסוגי טיול, תחומי עניין, קהלי יעד, עונות, ו-Place DNA. ראו migration 0016.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {!adminSecret ? (
        <EmptyState icon={<span>🔒</span>} title="נדרשת סיסמת אדמין" description="הזן את סיסמת האדמין למעלה כדי לטעון את הטקסונומיה." />
      ) : loading ? (
        <div className="admin-skeleton h-64 rounded-[var(--admin-radius-lg)]" />
      ) : (
        <div className="grid grid-cols-[240px_1fr] gap-5">
          {/* רשימת קבוצות בצד */}
          <div className="flex flex-col gap-1 rounded-[var(--admin-radius-lg)] border p-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
            <button
              onClick={() => setSelectedGroup(null)}
              className="flex items-center justify-between rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13px] font-medium transition"
              style={{ background: selectedGroup === null ? "var(--admin-accent-soft)" : "transparent", color: selectedGroup === null ? "var(--admin-accent)" : "var(--admin-ink)" }}
            >
              <span>הכל</span>
              <Badge tone="neutral">{terms.length}</Badge>
            </button>
            {groupCounts.map(([group, count]) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className="flex items-center justify-between rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13px] font-medium transition"
                style={{ background: selectedGroup === group ? "var(--admin-accent-soft)" : "transparent", color: selectedGroup === group ? "var(--admin-accent)" : "var(--admin-ink)" }}
              >
                <span>{GROUP_LABELS[group] ?? group}</span>
                <Badge tone="neutral">{count}</Badge>
              </button>
            ))}
          </div>

          {/* טבלת המונחים */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי ערך או תווית..." />
              <AdminButton onClick={() => openNewTerm()}>+ מונח / קבוצה חדשה</AdminButton>
            </div>
            {visibleTerms.length === 0 ? (
              <EmptyState
                icon={<span>◈</span>}
                title="אין מונחים"
                description="לחץ על 'מונח / קבוצה חדשה' כדי ליצור את הראשון."
                action={<AdminButton onClick={() => openNewTerm()}>+ מונח / קבוצה חדשה</AdminButton>}
              />
            ) : (
              <div className="rounded-[var(--admin-radius-lg)] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
                <DataTable columns={columns} rows={visibleTerms} keyFor={(t) => t.id} emptyMessage="אין מונחים" />
              </div>
            )}
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "עריכת מונח" : "מונח חדש"}
        subtitle={editingId ? undefined : "קבוצת טקסונומיה חדשה נוצרת אוטומטית אם היא לא קיימת עדיין"}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDrawerOpen(false)}>ביטול</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving}>{saving ? "שומר..." : "שמירה"}</AdminButton>
          </>
        }
      >
        <DrawerSection title="זיהוי">
          <AdminField label="קבוצת טקסונומיה (מפתח, לדוגמה: trip_type)">
            <div className="admin-ltr-value">
              <input
                value={form.taxonomy_group}
                onChange={(e) => setForm((f) => ({ ...f, taxonomy_group: e.target.value }))}
                placeholder="trip_type"
                className={adminInputClass}
                style={adminInputStyle}
                disabled={Boolean(editingId)}
                list="taxonomy-groups-list"
              />
              <datalist id="taxonomy-groups-list">
                {groupCounts.map(([g]) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          </AdminField>
          <AdminField label="ערך (מפתח יציב, באנגלית)">
            <div className="admin-ltr-value">
              <input
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="day_trip"
                className={adminInputClass}
                style={adminInputStyle}
                disabled={Boolean(editingId)}
              />
            </div>
          </AdminField>
          <AdminField label="תווית בעברית">
            <input
              value={form.label_he}
              onChange={(e) => setForm((f) => ({ ...f, label_he: e.target.value }))}
              placeholder="טיול יומי"
              className={adminInputClass}
              style={adminInputStyle}
            />
          </AdminField>
          <AdminField label="אימוג'י (אופציונלי)">
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder="🌿"
              className={adminInputClass}
              style={adminInputStyle}
            />
          </AdminField>
        </DrawerSection>

        <DrawerSection title="היררכיה (אופציונלי)">
          <AdminField label="מונח אב (לתת-קטגוריה - למשל תחת 'מסלולי טבע ונופים')">
            <select
              value={form.parent_term_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_term_id: e.target.value }))}
              className={adminInputClass}
              style={adminInputStyle}
            >
              <option value="">— ללא (מונח ראשי) —</option>
              {parentOptionsForForm.map((t) => (
                <option key={t.id} value={t.id}>
                  {GROUP_LABELS[t.taxonomy_group] ?? t.taxonomy_group} / {t.label_he}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="סדר תצוגה">
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
