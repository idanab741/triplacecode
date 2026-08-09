"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";

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
  needs_review_count: number;
  created_at: string;
}

export default function DiscoveryJobPage() {
  const { secret: adminSecret } = useAdminSecret();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<DiscoveryJob | null>(null);

  useEffect(() => {
    if (!adminSecret || !id) return;
    fetch(`/api/admin/discovery-jobs/${id}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => setJob(data.job))
      .catch(() => {});
  }, [adminSecret, id]);

  if (!job) {
    return <p className="p-6 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>טוען...</p>;
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <Link href="/admin/discovery" className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
        ← חיפוש חדש
      </Link>
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        בקשת חיפוש נוצרה
      </h1>

      <div className="max-w-lg rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
        <dl className="flex flex-col gap-2 text-[13.5px]">
          <Row label="סוג טיול" value={job.trip_type} />
          <Row label="קטגוריות" value={job.categories.join(", ") || "—"} />
          <Row label="דירוג מינימלי" value={String(job.min_rating)} />
          <Row label="כמות מבוקשת" value={String(job.requested_quantity)} />
          <Row label="סטטוס" value={job.status} />
        </dl>
      </div>

      <div className="max-w-lg rounded-[var(--admin-radius-lg)] border-2 border-dashed p-5" style={{ borderColor: "var(--admin-border)" }}>
        <p className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
          ⏳ מנוע הביצוע בפאזה הבאה
        </p>
        <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          הבקשה נשמרה. חיפוש Google בפועל + זיהוי כפילויות + AI Enrichment + סיווג TripMatch + חישוב Confidence — עדיין לא בנוי.
          כרגע זה שלד ה-UI וה-Job tracking (סעיף 73 במפרט), לא המנוע המלא.
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
