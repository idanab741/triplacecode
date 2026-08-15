"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton } from "@/screens/admin/shared/Drawer";

const ADMIN_SECRET_HEADER = "x-admin-secret";

interface DiscoveryJob {
  id: string;
  trip_type: string;
  categories: string[];
  filters: Record<string, string>;
  min_rating: number;
  requested_quantity: number;
  status: string;
  found_count: number;
  approved_count: number;
  duplicate_count: number;
  needs_review_count: number;
  created_at: string;
}

export default function DiscoveryJobPage() {
  const { secret: adminSecret } = useAdminSecret();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/discovery-jobs/${id}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => setJob(data.job))
      .catch(() => {});
  }

  useEffect(() => {
    if (!adminSecret || !id) return;
    load();
  }, [adminSecret, id]);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/admin/discovery-jobs/${id}/execute`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "הרצת החיפוש נכשלה");
    } finally {
      setRunning(false);
    }
  }

  if (!job) {
    return <p className="p-6 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>טוען...</p>;
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <Link href="/admin/discovery" className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
        → חיפוש חדש
      </Link>
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        בקשת חיפוש
      </h1>

      <div className="max-w-lg rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
        <dl className="flex flex-col gap-2 text-[13.5px]">
          <Row label="סוג טיול" value={job.trip_type} />
          <Row label="קטגוריות" value={job.categories.join(", ") || "—"} />
          <Row label="עיר/אזור" value={job.filters.city || job.filters.area || "לא הוגדר"} />
          <Row label="דירוג מינימלי" value={String(job.min_rating)} />
          <Row label="כמות מבוקשת" value={String(job.requested_quantity)} />
          <Row label="סטטוס" value={job.status} />
          {job.status === "completed" && (
            <>
              <Row label="נמצאו מ-Google" value={String(job.found_count)} />
              <Row label="נשמרו (חדשים)" value={String(job.approved_count)} />
              <Row label="דולגו (כפילויות/עריכה ידנית)" value={String(job.duplicate_count)} />
            </>
          )}
        </dl>
      </div>

      {job.status === "pending" && (
        <div className="max-w-lg">
          <AdminButton onClick={handleRun} disabled={running}>
            {running ? "מריץ חיפוש בגוגל..." : "▶ הרץ עכשיו"}
          </AdminButton>
          {runError && <p className="mt-2 text-[12.5px] text-red-600">{runError}</p>}
        </div>
      )}

      {job.status === "completed" && (
        <Link
          href={`/admin/places?city=${encodeURIComponent(job.filters.city || "")}`}
          className="max-w-lg text-[13.5px] font-medium"
          style={{ color: "var(--admin-accent)" }}
        >
          → לראות את המקומות שנשמרו ברשימת המקומות
        </Link>
      )}

      <div className="max-w-lg rounded-[var(--admin-radius-lg)] border-2 border-dashed p-5" style={{ borderColor: "var(--admin-border)" }}>
        <p className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
          ℹ️ גרסה ראשונה - לא הכל מיושם עדיין
        </p>
        <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          חיפוש Google + שמירה + מניעת כפילויות - כן פועל בפועל. AI Enrichment, סיווג TripMatch (20
          תגיות), Confidence Score, ורוב הפילטרים המתקדמים (עונה, נגישות, תקציב וכו׳) - עדיין לא
          מיושמים בפועל בשלב הזה.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--admin-border)" }}>
      <dt style={{ color: "var(--admin-ink-secondary)" }}>{label}</dt>
      <dd className="font-medium" style={{ color: "var(--admin-ink)" }}>
        {value}
      </dd>
    </div>
  );
}
