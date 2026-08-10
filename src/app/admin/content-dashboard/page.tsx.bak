"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard } from "@/screens/admin/shared/Primitives";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";

interface ModuleStat {
  module: string;
  label: string;
  total: number;
  missingMatches: number;
}

const ADMIN_SECRET_HEADER = "x-admin-secret";

/** מסך הכניסה החדש למערכת ניהול היעדים/אטרקציות - "מה חסר? מה צריך
 *  השלמה?" כפי שנדרש. שלב ראשון בבנייה מחדש (Audit כבר בוצע) - מתמקד
 *  בתמונת מצב חיה, לא עוד טבלה. הקישור לכל מודול עדיין מוביל לעמוד
 *  המקומות הקיים (עדיין לא נבנה Workspace ייעודי לכל מודול - זה השלב הבא). */
export default function ContentDashboardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [totalPlaces, setTotalPlaces] = useState<number | null>(null);
  const [modules, setModules] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/content-dashboard", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTotalPlaces(data.totalPlaces);
        setModules(data.modules ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת הנתונים"))
      .finally(() => setLoading(false));
  }, []);

  const totalMissing = modules.reduce((sum, m) => sum + m.missingMatches, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            יעדים ומקומות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            ניהול, גילוי, העשרה והתאמה חכמה של מקומות באמצעות AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/places"
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
          >
            + הוסף מקום ידנית דרך Google
          </Link>
          <Link
            href="/admin/discovery"
            className="rounded-[var(--admin-radius-sm)] px-3.5 py-2 text-[13.5px] font-medium text-white"
            style={{ background: "var(--admin-accent)" }}
          >
            🤖 מצא מקומות באמצעות AI
          </Link>
        </div>
      </div>

      {error && <p className="text-[13.5px] text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="סה״כ מקומות במאגר" value={loading ? "..." : String(totalPlaces ?? 0)} />
        <StatCard label="חסרה התאמת AI" value={loading ? "..." : String(totalMissing)} />
        <StatCard label="מודולים פעילים" value="8" />
        <StatCard label="דורש בדיקה ידנית" value="0" />
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          לפי מודול
        </h2>
        <div
          className="overflow-hidden rounded-[var(--admin-radius-lg)] border"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
        >
          {loading ? (
            <p className="p-6 text-center text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              טוען...
            </p>
          ) : (
            modules.map((m, i) => (
              <Link
                key={m.module}
                href={`/admin/places?module=${m.module}`}
                className="flex items-center justify-between px-5 py-4 transition hover:opacity-80"
                style={{ borderTop: i > 0 ? "1px solid var(--admin-border)" : undefined }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium" style={{ color: "var(--admin-ink)" }}>
                    {m.label}
                  </span>
                  <span className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                    {m.total} מקומות
                  </span>
                </div>
                {m.missingMatches > 0 ? (
                  <span
                    className="admin-mono rounded-full px-2.5 py-1 text-[12px] font-semibold"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    {m.missingMatches} חסרה התאמה
                  </span>
                ) : (
                  <span
                    className="admin-mono rounded-full px-2.5 py-1 text-[12px] font-semibold"
                    style={{ background: "#DCFCE7", color: "#166534" }}
                  >
                    ✓ הכל מתויג
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      </div>

      <p className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
        לחיצה על שורה תעביר לרשימת המקומות המסוננת של אותו מודול. Workspace ייעודי לכל מודול (טאבים,
        עריכה מהירה, AI Confidence Score) — השלב הבא בבנייה.
      </p>
    </div>
  );
}
