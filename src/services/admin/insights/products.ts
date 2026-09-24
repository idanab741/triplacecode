import { type Db, type RangeKey, periodFor, buildBuckets, seriesCount, inCurrent, inPrevious, pctDelta, topCounts, safeFetchAll } from "./core";
import { loadActivity, displayName } from "./activity";
import { TRIP_TYPE_LABELS, TRIP_STATUS_LABELS, TOKEN_TYPE_LABELS, label } from "./labels";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { UNLIMITED_TRIPS_PROMO, MONTHLY_TOKEN_ALLOWANCE, TOKEN_COSTS } from "@/constants/tokenCosts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function buildProducts(db: Db, range: RangeKey) {
  const p = periodFor(range);
  const b = buildBuckets(p);
  const data = await loadActivity(db);
  const { tripSessions, trippy, tripMatch, tokens, profiles, users } = data;
  const profileById = new Map(profiles.map((x) => [x.id, x]));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  // ---------------- Trip Builder ----------------
  const tbCur = tripSessions.filter((s) => inCurrent(p, s.created_at));
  const tbPrev = tripSessions.filter((s) => inPrevious(p, s.created_at));
  const types = [...new Set(tripSessions.map((s) => s.trip_type))];
  const byType = types
    .map((t) => {
      const rows = tbCur.filter((s) => s.trip_type === t);
      const completed = rows.filter((s) => s.status === "completed").length;
      return {
        key: t,
        label: label(TRIP_TYPE_LABELS, t),
        started: rows.length,
        completed,
        saved: rows.filter((s) => s.is_saved).length,
        completionPct: rows.length ? Math.round((completed / rows.length) * 100) : null,
      };
    })
    .filter((x) => x.started > 0)
    .sort((a, c) => c.started - a.started);
  const statusBreakdown = topCounts(tbCur.map((s) => s.status), 10).map((x) => ({ key: x.label, label: label(TRIP_STATUS_LABELS, x.label), value: x.value }));
  const tbCompletedCur = tbCur.filter((s) => s.status === "completed").length;

  const tripBuilder = {
    started: tbCur.length,
    startedDelta: pctDelta(tbCur.length, tbPrev.length),
    completed: tbCompletedCur,
    completionPct: tbCur.length ? Math.round((tbCompletedCur / tbCur.length) * 100) : null,
    savedPct: tbCompletedCur ? Math.round((tbCur.filter((s) => s.is_saved).length / tbCompletedCur) * 100) : null,
    uniqueUsers: new Set(tbCur.map((s) => s.user_id)).size,
    byType,
    statusBreakdown,
    series: [
      { key: "started", label: "התחילו", values: seriesCount(b, tripSessions.map((s) => s.created_at)) },
      { key: "completed", label: "הושלמו", values: seriesCount(b, tripSessions.filter((s) => s.status === "completed").map((s) => s.created_at)) },
    ],
  };

  // ---------------- TripMatch ----------------
  const tmCur = tripMatch.filter((r) => inCurrent(p, r.created_at));
  const likes = tmCur.reduce((s, r) => s + (r.liked_place_ids?.length ?? 0), 0);
  const rejects = tmCur.reduce((s, r) => s + (r.rejected_place_ids?.length ?? 0), 0);
  const likedCounts = new Map<string, number>();
  for (const r of tmCur) for (const id of r.liked_place_ids ?? []) likedCounts.set(id, (likedCounts.get(id) ?? 0) + 1);
  const topLikedIds = [...likedCounts.entries()].sort((a, c) => c[1] - a[1]).slice(0, 10);
  const uuidIds = topLikedIds.map(([id]) => id).filter((id) => UUID_RE.test(id));
  const { data: likedPlaces } = uuidIds.length
    ? await db.from("places").select("id,name,city,image_urls").in("id", uuidIds)
    : { data: [] as { id: string; name: string; city: string | null; image_urls: string[] | null }[] };
  const placeById = new Map(((likedPlaces ?? []) as { id: string; name: string; city: string | null; image_urls: string[] | null }[]).map((x) => [x.id, x]));
  const tripMatchToTrip = tbCur.filter((s) => s.trip_type === "tripmatch").length;

  const tripMatchData = {
    sessions: tmCur.length,
    sessionsDelta: pctDelta(tmCur.length, tripMatch.filter((r) => inPrevious(p, r.created_at)).length),
    uniqueUsers: new Set(tmCur.map((r) => r.user_id)).size,
    likes,
    rejects,
    likeRatePct: likes + rejects ? Math.round((likes / (likes + rejects)) * 100) : null,
    avgSwipes: tmCur.length ? Math.round(((likes + rejects) / tmCur.length) * 10) / 10 : null,
    zeroSwipeSessions: tmCur.filter((r) => (r.liked_place_ids?.length ?? 0) + (r.rejected_place_ids?.length ?? 0) === 0).length,
    convertedToTrip: tripMatchToTrip,
    topCities: topCounts(tmCur.map((r) => r.city), 8),
    topCategories: topCounts(tmCur.map((r) => r.category), 8).map((x) => ({ ...x, label: getPlaceCategoryLabel(x.label) })),
    topLiked: topLikedIds.map(([id, value]) => ({
      id,
      name: placeById.get(id)?.name ?? id.slice(0, 10),
      city: placeById.get(id)?.city ?? null,
      imageUrl: placeById.get(id)?.image_urls?.[0] ?? null,
      value,
    })),
    series: [
      { key: "sessions", label: "סשנים", values: seriesCount(b, tripMatch.map((r) => r.created_at)) },
    ],
  };

  // ---------------- Trippy AI ----------------
  const trCur = trippy.filter((r) => inCurrent(p, r.created_at));
  const charges = tokens.filter((t) => t.type === "trippy_ai_generation" && inCurrent(p, t.created_at)).length;
  const refunds = tokens.filter((t) => t.type === "trippy_ai_generation_refund" && inCurrent(p, t.created_at)).length;
  const { data: promptRows } = await db.from("trippy_ai_results").select("id,user_id,title,free_text,created_at").order("created_at", { ascending: false }).limit(12);
  const prompts = (promptRows ?? []) as { id: string; user_id: string; title: string | null; free_text: string | null; created_at: string }[];
  const trippyData = {
    generations: trCur.length,
    generationsDelta: pctDelta(trCur.length, trippy.filter((r) => inPrevious(p, r.created_at)).length),
    uniqueUsers: new Set(trCur.map((r) => r.user_id)).size,
    savedPct: trCur.length ? Math.round((trCur.filter((r) => r.is_saved).length / trCur.length) * 100) : null,
    attempts: charges,
    failures: refunds,
    failureRatePct: charges ? Math.round((refunds / charges) * 100) : null,
    topCities: topCounts(trCur.map((r) => r.city), 8),
    recentPrompts: prompts.slice(0, 12).map((r) => ({
      id: r.id,
      title: r.title,
      text: r.free_text,
      at: r.created_at,
      userName: displayName(profileById.get(r.user_id), emailById.get(r.user_id)),
    })),
    series: [
      { key: "generations", label: "טיולים שנוצרו", values: seriesCount(b, trippy.map((r) => r.created_at)) },
      { key: "failures", label: "כשלונות (החזרים)", values: seriesCount(b, tokens.filter((t) => t.type === "trippy_ai_generation_refund").map((t) => t.created_at)) },
    ],
  };

  // ---------------- Tokens ----------------
  const tkCur = tokens.filter((t) => inCurrent(p, t.created_at));
  const tokenData = {
    promoUnlimited: UNLIMITED_TRIPS_PROMO,
    monthlyAllowance: MONTHLY_TOKEN_ALLOWANCE,
    costs: Object.entries(TOKEN_COSTS).map(([k, v]) => ({ key: k, label: label(TOKEN_TYPE_LABELS, k), value: v })),
    spent: tkCur.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
    refunded: tkCur.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    byType: [...new Set(tkCur.map((t) => t.type))]
      .map((type) => {
        const rows = tkCur.filter((t) => t.type === type);
        return { key: type, label: label(TOKEN_TYPE_LABELS, type), count: rows.length, amount: rows.reduce((s, t) => s + t.amount, 0) };
      })
      .sort((a, c) => c.count - a.count),
  };

  // ---------------- Favorites ----------------
  const favs = await safeFetchAll<{ place_id: string; place_type: string; status: string }>("favorites", data.errors, (f, t) =>
    db.from("favorites").select("place_id,place_type,status").eq("place_type", "place").in("status", ["liked", "saved"]).order("id").range(f, t)
  );
  const favCounts = topCounts(favs.map((x) => x.place_id), 10);
  const { data: favPlaces } = favCounts.length
    ? await db.from("places").select("id,name,city,image_urls").in("id", favCounts.map((x) => x.label))
    : { data: [] };
  const favById = new Map(((favPlaces ?? []) as { id: string; name: string; city: string | null; image_urls: string[] | null }[]).map((x) => [x.id, x]));
  const favorites = favCounts.map((x) => ({
    id: x.label,
    name: favById.get(x.label)?.name ?? "מקום שנמחק",
    city: favById.get(x.label)?.city ?? null,
    imageUrl: favById.get(x.label)?.image_urls?.[0] ?? null,
    value: x.value,
  }));

  return {
    range,
    labels: b.labels,
    generatedAt: new Date().toISOString(),
    tripBuilder,
    tripMatch: tripMatchData,
    trippy: trippyData,
    tokens: tokenData,
    favorites,
    warnings: data.errors,
  };
}

export type ProductsData = Awaited<ReturnType<typeof buildProducts>>;
