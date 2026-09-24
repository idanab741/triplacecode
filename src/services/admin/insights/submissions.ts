import type { Db } from "./core";

export type SubmissionKind = "place" | "tripadd";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export const SUBMISSION_CATEGORIES: Record<SubmissionKind, { value: string; label: string }[]> = {
  place: [
    { value: "restaurant", label: "מסעדה" },
    { value: "attraction", label: "אטרקציה" },
    { value: "nature", label: "טבע" },
    { value: "nightlife", label: "חיי לילה" },
    { value: "hotel", label: "מלון" },
    { value: "shopping", label: "קניות" },
  ],
  tripadd: [
    { value: "food", label: "אוכל" },
    { value: "attraction", label: "אטרקציה" },
    { value: "nature", label: "טבע" },
    { value: "nightlife", label: "חיי לילה" },
    { value: "sleep", label: "לינה" },
    { value: "shopping", label: "קניות" },
  ],
};

const TABLE: Record<SubmissionKind, string> = { place: "place_submissions", tripadd: "tripadd_submissions" };
const MEDIA: Record<SubmissionKind, string> = { place: "place_submission_media", tripadd: "tripadd_submission_media" };

export interface AdminSubmission {
  id: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  shortDescription: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  googlePlaceId: string | null;
  googleMatch: string | null;
  photos: string[];
  googlePhotoUrl: string | null;
  rejectionReason: string | null;
  submittedById: string;
  submittedBy: string;
  createdAt: string;
  reviewedAt: string | null;
}

const COMMON = "id,status,name,category,subcategory,description,short_description,city,address,latitude,longitude,website,phone,rating,google_place_id,google_photo_url,rejection_reason,submitted_by,created_at,reviewed_at";

interface Row {
  id: string;
  status: SubmissionStatus;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  short_description: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  google_place_id: string | null;
  google_photo_url: string | null;
  google_match_status?: string | null;
  rejection_reason: string | null;
  submitted_by: string;
  created_at: string;
  reviewed_at: string | null;
  media?: { sort_order: number; media_assets: { url: string } | null }[] | null;
}

async function loadKind(db: Db, kind: SubmissionKind, status: SubmissionStatus | "all", q: string): Promise<Row[]> {
  const columns = `${COMMON}${kind === "tripadd" ? ",google_match_status" : ""},media:${MEDIA[kind]}(sort_order,media_assets(url))`;
  let query = db.from(TABLE[kind]).select(columns).order("created_at", { ascending: status === "pending" }).limit(200);
  if (status !== "all") query = query.eq("status", status);
  const term = q.trim().replace(/[%,()]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(`${TABLE[kind]}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

function toAdmin(kind: SubmissionKind, r: Row, names: Map<string, string>): AdminSubmission {
  return {
    id: r.id,
    kind,
    status: r.status,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory,
    description: r.description,
    shortDescription: r.short_description,
    city: r.city,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    website: r.website,
    phone: r.phone,
    rating: r.rating,
    googlePlaceId: r.google_place_id,
    googleMatch: r.google_match_status ?? null,
    photos: (r.media ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.media_assets?.url)
      .filter((u): u is string => Boolean(u)),
    googlePhotoUrl: r.google_photo_url,
    rejectionReason: r.rejection_reason,
    submittedById: r.submitted_by,
    submittedBy: names.get(r.submitted_by) ?? "משתמש",
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

export async function listSubmissions(db: Db, status: SubmissionStatus | "all", q: string) {
  const [places, tripadds] = await Promise.all([loadKind(db, "place", status, q), loadKind(db, "tripadd", status, q)]);
  const ids = [...new Set([...places, ...tripadds].map((r) => r.submitted_by))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("id,full_name,username").in("id", ids) : { data: [] };
  const names = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; username: string | null }[]).map((p) => [p.id, p.full_name?.trim() || (p.username ? `@${p.username}` : "משתמש")])
  );
  const rows = [...places.map((r) => toAdmin("place", r, names)), ...tripadds.map((r) => toAdmin("tripadd", r, names))];
  rows.sort((a, b) => (status === "pending" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));

  const counts: Record<SubmissionStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  await Promise.all(
    (["pending", "approved", "rejected"] as SubmissionStatus[]).flatMap((s) =>
      (["place", "tripadd"] as SubmissionKind[]).map(async (k) => {
        const { count } = await db.from(TABLE[k]).select("id", { count: "exact", head: true }).eq("status", s);
        counts[s] += count ?? 0;
      })
    )
  );
  return { submissions: rows, counts, categories: SUBMISSION_CATEGORIES };
}

export interface SubmissionPatch {
  name?: string;
  category?: string;
  subcategory?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  phone?: string | null;
  googlePlaceId?: string | null;
}

const textOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 2000) : null;
};

/** מאמת ומתרגם שינוי מהאדמין לעמודות DB. זורק שגיאה על ערך לא תקין. */
export function buildUpdate(kind: SubmissionKind, patch: SubmissionPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = textOrNull(patch.name);
    if (!name) throw new Error("שם לא יכול להיות ריק");
    out.name = name.slice(0, 200);
  }
  if (patch.category !== undefined) {
    if (!SUBMISSION_CATEGORIES[kind].some((c) => c.value === patch.category)) throw new Error("קטגוריה לא תקינה");
    out.category = patch.category;
  }
  if (patch.subcategory !== undefined) out.subcategory = textOrNull(patch.subcategory);
  if (patch.description !== undefined) out.description = textOrNull(patch.description);
  if (patch.shortDescription !== undefined) out.short_description = textOrNull(patch.shortDescription);
  if (patch.city !== undefined) out.city = textOrNull(patch.city);
  if (patch.address !== undefined) out.address = textOrNull(patch.address);
  if (patch.website !== undefined) out.website = textOrNull(patch.website);
  if (patch.phone !== undefined) out.phone = textOrNull(patch.phone);
  if (patch.googlePlaceId !== undefined) out.google_place_id = textOrNull(patch.googlePlaceId);

  const hasLat = patch.latitude !== undefined;
  const hasLng = patch.longitude !== undefined;
  if (hasLat !== hasLng) throw new Error("יש לעדכן קו רוחב וקו אורך יחד");
  if (hasLat && hasLng) {
    const lat = patch.latitude === null ? null : Number(patch.latitude);
    const lng = patch.longitude === null ? null : Number(patch.longitude);
    if ((lat === null) !== (lng === null)) throw new Error("מיקום חלקי");
    if (lat !== null && lng !== null) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("קואורדינטות לא תקינות");
    }
    out.latitude = lat;
    out.longitude = lng;
    // מיקום שתוקן ידנית ע"י אדמין - מסמנים כך שה-AI/ההעשרה לא "יתקנו" אותו חזרה
    if (kind === "tripadd") out.google_match_status = "manual";
  }
  return out;
}

export async function updateSubmission(db: Db, kind: SubmissionKind, id: string, patch: SubmissionPatch, approve: boolean): Promise<void> {
  const update = buildUpdate(kind, patch);
  if (approve) {
    update.status = "approved";
    update.reviewed_at = new Date().toISOString();
    update.rejection_reason = null;
  }
  if (!Object.keys(update).length) return;
  const { data, error } = await db.from(TABLE[kind]).update(update).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || (data as unknown[]).length === 0) throw new Error("ההצעה לא נמצאה");
}
