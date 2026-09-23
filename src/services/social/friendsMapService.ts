import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/services/supabase/admin";

export interface FriendsMapRecommender {
  id: string;
  name: string;
  avatarUrl: string | null;
  isSelf: boolean;
}

/** תרומה אחת של משתמש למקום: פוסט, ביקורת/דירוג, או העלאת המקום עצמו. */
export interface FriendsMapContribution {
  id: string;
  kind: "post" | "review" | "added";
  userId: string;
  /** לקישור לפרופיל (/places/profile/[username]) - ואם חסר, משתמשים ב-userId. */
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isSelf: boolean;
  isFriend: boolean;
  text: string | null;
  /** דירוג 1-5 של המשתמש (אם דירג). */
  rating: number | null;
  /** התמונות שהמשתמש עצמו העלה (לא תמונת המקום הכללית). */
  photos: string[];
  createdAt: string;
}

export interface FriendsMapPin {
  /** מפתח יציב לפין (אחרי איחוד כפילויות) - משמש גם כ-key ב-React. */
  key: string;
  /** היעד בלחיצה על "לעמוד המקום" - עדיפות למקום מהמאגר (places) על פני tripadd. */
  placeId: string;
  source: "place" | "tripadd";
  name: string;
  latitude: number;
  longitude: number;
  /** תמונת הנעץ: התמונה העדכנית ביותר שמשתמש העלה, ואם אין - תמונת המקום. */
  imageUrl: string | null;
  city: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** ממוצע הדירוגים של המשתמשים (אם דירגו). */
  userRatingAvg: number | null;
  userRatingCount: number;
  /** מי תרם (הכי עדכני קודם, עד 5) - ייחודי למשתמש. */
  recommenders: FriendsMapRecommender[];
  recommendersCount: number;
  /** כל התרומות של כל המשתמשים למקום המאוחד, מהחדשה לישנה. */
  contributions: FriendsMapContribution[];
  /** כל התמונות של המשתמשים יחד (עד 12), מהחדשה לישנה - לכרטיס שעל המפה. */
  photos: string[];
  latestText: string | null;
  latestAt: string;
  hasFriend: boolean;
  hasSelf: boolean;
}

const POST_LIMIT = 600;
const SUBMISSION_LIMIT = 1000;
const REVIEW_LIMIT = 1500;
const TEXT_SNIPPET_CHARS = 140;
const MAX_CONTRIBUTIONS_PER_PIN = 40;
const MAX_PHOTOS_PER_CONTRIBUTION = 10;
const MAX_PIN_PHOTOS = 12;
/** שני מקומות בלי מזהה גוגל משותף מאוחדים אם הם במרחק הזה ובעלי אותו שם. */
const MERGE_DISTANCE_M = 60;
const IN_CHUNK = 150;

type Row = Record<string, unknown>;

/** .in() עם הרבה מזהים יוצר URL ארוך מדי - מפצלים לקבוצות. */
async function selectIn(ids: string[], run: (chunk: string[]) => PromiseLike<{ data: unknown }>): Promise<Row[]> {
  if (ids.length === 0) return [];
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    try {
      const { data } = await run(ids.slice(i, i + IN_CHUNK));
      if (Array.isArray(data)) out.push(...(data as Row[]));
    } catch {
      // השלמת תצוגה בלבד - כשל חלקי לא מפיל את כל המפה.
    }
  }
  return out;
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/["'`׳״.,\-–—_()|/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 3 && long.includes(short);
}

type MediaRow = { type?: string | null; url?: string | null; thumbnail_url?: string | null } | null | undefined;

function mediaUrl(m: MediaRow): string | null {
  if (!m) return null;
  if (m.type === "video") return m.thumbnail_url ?? null;
  return m.url ?? m.thumbnail_url ?? null;
}

/** מיקום גולמי אחד (שורה ב-places או ב-tripadd_submissions) לפני האיחוד. */
interface Loc {
  rawKey: string;
  source: "place" | "tripadd";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  city: string | null;
  rating: number | null;
  ratingCount: number | null;
  googlePlaceId: string | null;
  createdAt: string | null;
}

const SUBMISSION_COLUMNS =
  "id, submitted_by, name, description, rating, latitude, longitude, city, address, google_rating, google_rating_count, google_place_id, status, created_at";

/**
 * *** מפת place's (בקשה מפורשת - "כל המקומות שאנשים העלו, מכל המשתמשים, כמקומות
 * במפה - פין אחד למקום; לאחד מקומות שמועלים כמה פעמים, ובתוך המקום המאוחד את כל
 * מה שהמשתמשים העלו, עם התמונות שלהם"):
 *
 * מקורות (כל המשתמשים, לא רק חברים):
 *  - פוסטים וביקורות שמקושרים למקום (places) או למקום שהועלה (tripadd). נשלפים עם
 *    הלקוח הרגיל - RLS מסנן בדיוק כמו בפיד (ציבורי / חברים / עוקבים / חסימות).
 *  - מקומות שמשתמשים העלו (tripadd_submissions שלא נדחו) + התמונות שהעלו איתם.
 *  - דירוגים: place_reviews (מקומות מהמאגר) ו-tripadd_reviews (מקומות שהועלו).
 *
 * איחוד כפילויות: (1) אותו google_place_id - גם בין places ל-tripadd; (2) בלי מזהה
 * משותף - מרחק עד MERGE_DISTANCE_M ושם תואם. כל התרומות של כל המשתמשים נכנסות
 * לפין המאוחד. אצל אותו משתמש, דירוג/העלאה שכפולים לפוסט שלו מתמזגים לתוכו.
 *
 * תמונות המדיה נשלפות עם admin client - בדיוק כמו feedService: ה-RLS של
 * media_assets מגביל לבעלים, וכאן זה רק השלמת תצוגה לתוכן שכבר עבר סינון נראות.
 */
export async function getFriendsMapPins(
  supabase: SupabaseClient,
  viewerId: string
): Promise<{ pins: FriendsMapPin[]; friendsCount: number }> {
  const admin = createAdminClient();

  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
    .eq("status", "accepted");
  const friendIds = new Set(
    (friendships ?? []).map((row) => (row.requester_id === viewerId ? row.addressee_id : row.requester_id) as string)
  );

  // ---------- 1. תוכן גולמי ----------
  const [postsRes, submissionsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, author_id, text, post_type, place_id, tripadd_submission_id, created_at")
      .is("deleted_at", null)
      .or("place_id.not.is.null,tripadd_submission_id.not.is.null")
      .order("created_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase
      .from("tripadd_submissions")
      .select(SUBMISSION_COLUMNS)
      .neq("status", "rejected")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false })
      .limit(SUBMISSION_LIMIT),
  ]);
  if (postsRes.error) throw postsRes.error;

  const posts = (postsRes.data ?? []) as Row[];
  const submissions = (submissionsRes.data ?? []) as Row[];

  const postPlaceIds = [...new Set(posts.map((p) => p.place_id as string | null).filter((id): id is string => !!id))];
  const submissionIds = new Set(submissions.map((s) => s.id as string));
  // פוסטים שמקושרים ל-tripadd שלא נכלל למעלה (למשל מעבר למגבלה) - משלימים אותם.
  const missingTripAddIds = [
    ...new Set(
      posts
        .map((p) => p.tripadd_submission_id as string | null)
        .filter((id): id is string => !!id && !submissionIds.has(id))
    ),
  ];
  if (missingTripAddIds.length) {
    const extra = await selectIn(missingTripAddIds, (chunk) =>
      supabase.from("tripadd_submissions").select(SUBMISSION_COLUMNS).in("id", chunk)
    );
    for (const s of extra) {
      if (s.status === "rejected") continue;
      submissions.push(s);
      submissionIds.add(s.id as string);
    }
  }
  const allSubmissionIds = [...submissionIds];
  const postIds = posts.map((p) => p.id as string);

  // ---------- 2. השלמות: מקומות, מדיה, דירוגים ----------
  const [placesRows, postMediaRows, submissionMediaRows, tripAddReviewRows, placeReviewRows] = await Promise.all([
    selectIn(postPlaceIds, (chunk) =>
      supabase
        .from("places")
        .select("id, name, image_urls, latitude, longitude, city, rating, rating_count, google_place_id")
        .in("id", chunk)
    ),
    selectIn(postIds, (chunk) =>
      admin
        .from("post_media")
        .select("post_id, sort_order, media:media_assets(type, url, thumbnail_url)")
        .in("post_id", chunk)
        .order("sort_order", { ascending: true })
    ),
    selectIn(allSubmissionIds, (chunk) =>
      admin
        .from("tripadd_submission_media")
        .select("submission_id, sort_order, media:media_assets(type, url, thumbnail_url)")
        .in("submission_id", chunk)
        .order("sort_order", { ascending: true })
    ),
    selectIn(allSubmissionIds, (chunk) =>
      supabase
        .from("tripadd_reviews")
        .select("id, submission_id, user_id, rating, description, created_at")
        .in("submission_id", chunk)
        .order("created_at", { ascending: false })
        .limit(REVIEW_LIMIT)
    ),
    selectIn(postPlaceIds, (chunk) =>
      supabase.from("place_reviews").select("id, place_id, user_id, rating, comment, post_id, created_at").in("place_id", chunk)
    ),
  ]);

  const reviewMediaRows = await selectIn(
    placeReviewRows.map((r) => r.id as string),
    (chunk) =>
      admin
        .from("review_media")
        .select("review_id, sort_order, media:media_assets(type, url, thumbnail_url)")
        .in("review_id", chunk)
        .order("sort_order", { ascending: true })
  );

  function groupMedia(rows: Row[], idField: string): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const media = row.media as MediaRow | MediaRow[];
      const url = mediaUrl(Array.isArray(media) ? media[0] : media);
      if (!url) continue;
      const id = row[idField] as string;
      const list = map.get(id) ?? [];
      if (!list.includes(url)) list.push(url);
      map.set(id, list);
    }
    return map;
  }
  const postPhotos = groupMedia(postMediaRows, "post_id");
  const submissionPhotos = groupMedia(submissionMediaRows, "submission_id");
  const reviewPhotos = groupMedia(reviewMediaRows, "review_id");

  // ---------- 3. מיקומים גולמיים ----------
  const locs = new Map<string, Loc>();
  for (const row of placesRows) {
    if (row.latitude == null || row.longitude == null) continue;
    const images = row.image_urls as string[] | null;
    const rawKey = `place:${row.id}`;
    locs.set(rawKey, {
      rawKey,
      source: "place",
      id: row.id as string,
      name: row.name as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      imageUrl: images?.[0] ?? null,
      city: (row.city as string | null) ?? null,
      rating: (row.rating as number | null) ?? null,
      ratingCount: (row.rating_count as number | null) ?? null,
      googlePlaceId: (row.google_place_id as string | null) ?? null,
      createdAt: null,
    });
  }
  for (const row of submissions) {
    if (row.latitude == null || row.longitude == null) continue;
    const id = row.id as string;
    const rawKey = `tripadd:${id}`;
    locs.set(rawKey, {
      rawKey,
      source: "tripadd",
      id,
      name: row.name as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      imageUrl: submissionPhotos.get(id)?.[0] ?? null,
      city: (row.city as string | null) ?? (row.address as string | null) ?? null,
      rating: (row.google_rating as number | null) ?? null,
      ratingCount: (row.google_rating_count as number | null) ?? null,
      googlePlaceId: (row.google_place_id as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    });
  }

  // ---------- 4. איחוד כפילויות (union-find) ----------
  const locList = [...locs.values()];
  const parent = new Map<string, string>();
  for (const l of locList) parent.set(l.rawKey, l.rawKey);
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    let c = k;
    while (parent.get(c) !== r) {
      const next = parent.get(c) as string;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const byGoogle = new Map<string, string>();
  for (const l of locList) {
    if (!l.googlePlaceId) continue;
    const first = byGoogle.get(l.googlePlaceId);
    if (first) union(first, l.rawKey);
    else byGoogle.set(l.googlePlaceId, l.rawKey);
  }
  // קרבה + שם: רשת (~110 מ') כדי לא להשוות כל זוג עם כל זוג.
  const grid = new Map<string, Loc[]>();
  for (const l of locList) {
    const cell = `${Math.floor(l.latitude * 1000)}:${Math.floor(l.longitude * 1000)}`;
    const list = grid.get(cell) ?? [];
    list.push(l);
    grid.set(cell, list);
  }
  for (const l of locList) {
    const baseLat = Math.floor(l.latitude * 1000);
    const baseLng = Math.floor(l.longitude * 1000);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const other of grid.get(`${baseLat + dy}:${baseLng + dx}`) ?? []) {
          if (other.rawKey <= l.rawKey) continue;
          if (l.googlePlaceId && other.googlePlaceId && l.googlePlaceId !== other.googlePlaceId) continue;
          if (distanceM(l.latitude, l.longitude, other.latitude, other.longitude) > MERGE_DISTANCE_M) continue;
          if (namesMatch(l.name, other.name)) union(l.rawKey, other.rawKey);
        }
      }
    }
  }

  // ---------- 5. תרומות ----------
  const userIds = new Set<string>();
  for (const p of posts) userIds.add(p.author_id as string);
  for (const s of submissions) userIds.add(s.submitted_by as string);
  for (const r of tripAddReviewRows) userIds.add(r.user_id as string);
  for (const r of placeReviewRows) userIds.add(r.user_id as string);
  const profileRows = await selectIn([...userIds], (chunk) =>
    supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", chunk)
  );
  const profiles = new Map(profileRows.map((p) => [p.id as string, p]));

  function makeContribution(
    id: string,
    kind: FriendsMapContribution["kind"],
    userId: string,
    text: string | null,
    rating: number | null,
    photos: string[],
    createdAt: string
  ): FriendsMapContribution {
    const profile = profiles.get(userId);
    return {
      id,
      kind,
      userId,
      username: (profile?.username as string | null) ?? null,
      name: (profile?.full_name as string | null) ?? (profile?.username as string | null) ?? "מטייל",
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      isSelf: userId === viewerId,
      isFriend: friendIds.has(userId),
      text: text?.trim() || null,
      rating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
      photos: photos.slice(0, MAX_PHOTOS_PER_CONTRIBUTION),
      createdAt,
    };
  }

  /** root -> תרומות */
  const contributionsByRoot = new Map<string, FriendsMapContribution[]>();
  const push = (rawKey: string, c: FriendsMapContribution) => {
    if (!locs.has(rawKey)) return;
    const root = find(rawKey);
    const list = contributionsByRoot.get(root) ?? [];
    list.push(c);
    contributionsByRoot.set(root, list);
  };

  const postIdSet = new Set(postIds);
  const placeReviewByPost = new Map<string, Row>();
  for (const r of placeReviewRows) if (r.post_id && postIdSet.has(r.post_id as string)) placeReviewByPost.set(r.post_id as string, r);

  // פוסטים (כולל ביקורות שנכתבו כפוסט)
  for (const p of posts) {
    const rawKey = p.place_id ? `place:${p.place_id}` : `tripadd:${p.tripadd_submission_id}`;
    const linkedReview = placeReviewByPost.get(p.id as string);
    const photos = [...(postPhotos.get(p.id as string) ?? [])];
    if (linkedReview) {
      for (const u of reviewPhotos.get(linkedReview.id as string) ?? []) if (!photos.includes(u)) photos.push(u);
    }
    push(
      rawKey,
      makeContribution(
        `post:${p.id}`,
        p.post_type === "review" ? "review" : "post",
        p.author_id as string,
        (p.text as string | null) ?? (linkedReview?.comment as string | null) ?? null,
        (linkedReview?.rating as number | null) ?? null,
        photos,
        p.created_at as string
      )
    );
  }
  // דירוגים על מקומות מהמאגר שלא מקושרים לפוסט שכבר נכלל
  for (const r of placeReviewRows) {
    if (r.post_id && placeReviewByPost.has(r.post_id as string)) continue;
    push(
      `place:${r.place_id}`,
      makeContribution(
        `place_review:${r.id}`,
        "review",
        r.user_id as string,
        (r.comment as string | null) ?? null,
        (r.rating as number | null) ?? null,
        reviewPhotos.get(r.id as string) ?? [],
        r.created_at as string
      )
    );
  }
  // העלאת מקום (tripadd) - המעלה, עם התמונות שהעלה
  const submitterBySubmission = new Map<string, string>();
  for (const s of submissions) {
    const id = s.id as string;
    submitterBySubmission.set(id, s.submitted_by as string);
    push(
      `tripadd:${id}`,
      makeContribution(
        `added:${id}`,
        "added",
        s.submitted_by as string,
        (s.description as string | null) ?? null,
        (s.rating as number | null) ?? null,
        submissionPhotos.get(id) ?? [],
        s.created_at as string
      )
    );
  }
  // דירוגים על מקומות שהועלו. הדירוג של המעלה עצמו כבר בתוך "added".
  for (const r of tripAddReviewRows) {
    const submissionId = r.submission_id as string;
    if (submitterBySubmission.get(submissionId) === r.user_id) continue;
    push(
      `tripadd:${submissionId}`,
      makeContribution(
        `tripadd_review:${r.id}`,
        "review",
        r.user_id as string,
        (r.description as string | null) ?? null,
        (r.rating as number | null) ?? null,
        [],
        r.created_at as string
      )
    );
  }

  /** אצל אותו משתמש באותו מקום: דירוג/העלאה שכפולים לפוסט שלו מתמזגים לפוסט העדכני. */
  function mergeSameUser(list: FriendsMapContribution[]): FriendsMapContribution[] {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const hostByUser = new Map<string, FriendsMapContribution>();
    for (const c of sorted) if (c.id.startsWith("post:") && !hostByUser.has(c.userId)) hostByUser.set(c.userId, c);
    const result: FriendsMapContribution[] = [];
    for (const c of sorted) {
      const host = hostByUser.get(c.userId);
      if (host && !c.id.startsWith("post:")) {
        for (const u of c.photos) {
          if (!host.photos.includes(u) && host.photos.length < MAX_PHOTOS_PER_CONTRIBUTION) host.photos.push(u);
        }
        if (host.rating == null && c.rating != null) host.rating = c.rating;
        const duplicateText = !c.text || (host.text != null && normalizeName(c.text) === normalizeName(host.text));
        if (duplicateText) continue; // כפילות - נבלעה בפוסט
      }
      result.push(c);
    }
    return result;
  }

  // ---------- 6. פינים ----------
  const membersByRoot = new Map<string, Loc[]>();
  for (const l of locList) {
    const root = find(l.rawKey);
    const list = membersByRoot.get(root) ?? [];
    list.push(l);
    membersByRoot.set(root, list);
  }

  const pins: FriendsMapPin[] = [];
  for (const [root, rawList] of contributionsByRoot) {
    const members = membersByRoot.get(root) ?? [];
    if (members.length === 0) continue;
    const canonical =
      members.find((m) => m.source === "place") ??
      [...members].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];

    const contributions = mergeSameUser(rawList).slice(0, MAX_CONTRIBUTIONS_PER_PIN);
    if (contributions.length === 0) continue;

    const photos: string[] = [];
    for (const c of contributions) {
      for (const u of c.photos) if (photos.length < MAX_PIN_PHOTOS && !photos.includes(u)) photos.push(u);
    }

    const recommenders: FriendsMapRecommender[] = [];
    const seenUsers = new Set<string>();
    for (const c of contributions) {
      if (seenUsers.has(c.userId)) continue;
      seenUsers.add(c.userId);
      if (recommenders.length < 5) recommenders.push({ id: c.userId, name: c.name, avatarUrl: c.avatarUrl, isSelf: c.isSelf });
    }

    const ratings = contributions.map((c) => c.rating).filter((r): r is number => r != null);
    const latestText = contributions.find((c) => c.text)?.text ?? null;
    const ratingSource = members.find((m) => m.rating != null) ?? canonical;
    const avgLat = members.reduce((s, m) => s + m.latitude, 0) / members.length;
    const avgLng = members.reduce((s, m) => s + m.longitude, 0) / members.length;

    pins.push({
      key: root,
      placeId: canonical.id,
      source: canonical.source,
      name: canonical.name,
      latitude: canonical.source === "place" ? canonical.latitude : avgLat,
      longitude: canonical.source === "place" ? canonical.longitude : avgLng,
      imageUrl: photos[0] ?? members.find((m) => m.imageUrl)?.imageUrl ?? null,
      city: members.find((m) => m.city)?.city ?? null,
      rating: ratingSource.rating,
      ratingCount: ratingSource.ratingCount,
      userRatingAvg: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null,
      userRatingCount: ratings.length,
      recommenders,
      recommendersCount: seenUsers.size,
      contributions,
      photos,
      latestText: latestText
        ? latestText.length > TEXT_SNIPPET_CHARS
          ? `${latestText.slice(0, TEXT_SNIPPET_CHARS)}…`
          : latestText
        : null,
      latestAt: contributions[0].createdAt,
      hasFriend: contributions.some((c) => c.isFriend),
      hasSelf: contributions.some((c) => c.isSelf),
    });
  }

  pins.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  return { pins, friendsCount: friendIds.size };
}
