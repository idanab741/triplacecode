"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { StatCard } from "@/screens/admin/shared/Primitives";
import { LineChart, HorizontalBarChart } from "@/screens/admin/shared/Charts";
import { adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";

const ADMIN_SECRET_HEADER = "x-admin-secret";

interface DashboardData {
  totalUsers: number;
  newUsersThisMonth: number;
  activeUsers30d: number;
  tripsBuilt: number;
  tripsSaved: number;
  monthLabels: string[];
  signupsByMonth: number[];
  tripsByMonth: number[];
  topTripTypes: { label: string; value: number }[];
}

/** Dashboard מחובר לנתונים אמיתיים בלבד (Supabase Auth + trip_builder_sessions).
 *  בכוונה בלי "Conversion ל-Premium"/"Retention" - אין עדיין מושג של מנוי
 *  או טבלת אירועי login בסכמה הקיימת שמאפשרת לחשב את אלה באמת. */
export default function DashboardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    fetch("/api/admin/dashboard-stats", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת נתונים");
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה לא ידועה"))
      .finally(() => setLoading(false));
  }, [adminSecret]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            נתונים אמיתיים מ-Supabase (משתמשים + מסלולים)
          </p>
        </div>
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            הזן סיסמת אדמין כדי לטעון נתונים אמיתיים
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-skeleton h-28 rounded-[var(--admin-radius-lg)]" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="סה״כ משתמשים" value={data.totalUsers.toLocaleString()} icon={<Icon path="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0" />} />
            <StatCard label="משתמשים חדשים החודש" value={data.newUsersThisMonth.toLocaleString()} icon={<Icon path="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />} />
            <StatCard label="פעילים ב-30 יום" value={data.activeUsers30d.toLocaleString()} icon={<Icon path="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />} />
            <StatCard label="מסלולים שנבנו" value={data.tripsBuilt.toLocaleString()} icon={<Icon path="M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4m0 3-6-3" />} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="הרשמות" subtitle="12 החודשים האחרונים">
              <LineChart labels={data.monthLabels} series={[{ label: "הרשמות", color: "var(--admin-chart-1)", values: data.signupsByMonth }]} />
            </ChartCard>
            <ChartCard title="מסלולים שנבנו" subtitle="12 החודשים האחרונים">
              <LineChart labels={data.monthLabels} series={[{ label: "נבנו", color: "var(--admin-chart-3)", values: data.tripsByMonth }]} />
            </ChartCard>
          </div>

          <ChartCard title="סוגי טיולים מובילים" subtitle="לפי מספר מסלולים שנבנו">
            {data.topTripTypes.length > 0 ? (
              <HorizontalBarChart data={data.topTripTypes} color="var(--admin-chart-2)" />
            ) : (
              <p className="py-6 text-center text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
                אין עדיין מספיק נתונים
              </p>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="admin-fade-in flex flex-col gap-4 rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
      <div>
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          {title}
        </h3>
        <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
