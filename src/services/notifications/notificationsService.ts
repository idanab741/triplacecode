import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * *** תכונה חדשה (MASTER PROMPT - מרכז פעילות/התראות):
 * שתי קטגוריות נפרדות לגמרי, ר' migration 0059 להסבר המלא:
 * - Computed activity: טיול מתקרב / טיול שנשמר / מקום שנשמר - מחושב
 *   כאן מ-trip_builder_sessions/favorites הקיימים, לא נשמר כשורה.
 * - Persistent notifications: הודעות Admin, נשמרות בטבלת notifications.
 * activityKey דטרמיניסטי מאחד את שתיהן תחת אותו מנגנון read/unread
 * (notification_reads) - ר' getActivityKeyForNotification/buildTripUpcomingKey.
 */

export type ActivityTab = "all" | "trips" | "system" | "recommendations";

export interface ActivityItem {
  /** activity_key - ר' migration 0059. ייחודי בתוך הרשימה המאוחדת. */
  id: string;
  category: "trips" | "system" | "recommendations";
  priority: "normal" | "important" | "urgent";
  title: string;
  description: string;
  imageUrl: string | null;
  icon: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  timestamp: string; // ISO
  isRead: boolean;
}

interface TripSessionRow {
  id: string;
  trip_type: string;
  answers: Record<string, unknown> | null;
  final_itinerary: { stops?: { name?: string; imageUrls?: string[] }[] } | null;
  calendar_date: string | null;
  destination_image_url: string | null;
  created_at: string;
  is_saved: boolean | null;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
}

function tripDestinationLabel(row: TripSessionRow): string {
  const answers = row.answers as { destination?: string; requestedArea?: string } | null;
  const firstStopName = row.final_itinerary?.stops?.[0]?.name;
  return answers?.destination ?? answers?.requestedArea ?? firstStopName ?? "הטיול שלכם";
}

/** *** תיקון מכוון (MASTER PROMPT - "אין לבצע קריאת Google נוספת רק
 *  בשביל notification thumbnail"): destination_image_url רק אם כבר
 *  קיים בקאש (לא קוראים ל-getOrCacheTripThumbnail, שמבצע קריאת Google
 *  אם עוד לא קיים) - אחרת נופלים לתמונת התחנה הראשונה שכבר שמורה
 *  (final_itinerary.stops[0].imageUrls), ואם גם זה חסר - null (אייקון
 *  fallback בצד הלקוח, לא עוד קריאת רשת). */
function tripImageUrl(row: TripSessionRow): string | null {
  if (row.destination_image_url) return row.destination_image_url;
  return row.final_itinerary?.stops?.[0]?.imageUrls?.[0] ?? null;
}

/** מיליסטונים לטיול מתקרב, מהרחוק לקרוב - ר' MASTER PROMPT סעיף 7.
 *  ה-key (label) הוא חלק מ-activity_key הדטרמיניסטי - מעבר בין
 *  מיליסטון למיליסטון = key חדש = "לא נקרא" מחדש, אבל בתוך אותו
 *  מיליסטון תמיד אותו key (לא נוצרות "התראות" נוספות בכל טעינה). */
const TRIP_UPCOMING_MILESTONES: { maxDays: number; label: string; title: string; body: (dest: string) => string }[] = [
  { maxDays: 999999, label: "30d", title: "הטיול שלך מתקרב 🧳", body: (d) => `עוד כ-30 ימים יוצאים ל${d}.` },
  { maxDays: 30, label: "14d", title: "עוד שבועיים זה קורה 🧳", body: (d) => `הטיול שלך ל${d} מתקרב.` },
  { maxDays: 14, label: "7d", title: "עוד שבוע לטיול! 🎒", body: () => "אולי הגיע הזמן לעבור על המסלול." },
  { maxDays: 7, label: "3d", title: "הטיול שלך בעוד 3 ימים 🧳", body: (d) => `${d} מחכה לכם.` },
  { maxDays: 3, label: "1d", title: "מחר זה קורה! 🎒", body: () => "הטיול שלך מחכה לך." },
  { maxDays: 1, label: "0d", title: "היום יוצאים לדרך! 🧳", body: (d) => `יום נהדר ל${d}!` },
];

function milestoneForDaysUntil(daysUntil: number): (typeof TRIP_UPCOMING_MILESTONES)[number] | null {
  if (daysUntil < 0 || daysUntil > 30) return null;
  // הראשון (מהסוף) ש-daysUntil "נכנס" תחתיו (maxDays הוא הגבול העליון-לא-כולל של המיליסטון הקודם)
  for (let i = TRIP_UPCOMING_MILESTONES.length - 1; i >= 0; i--) {
    const m = TRIP_UPCOMING_MILESTONES[i];
    if (daysUntil < m.maxDays) return m;
  }
  return TRIP_UPCOMING_MILESTONES[0];
}

const SAVED_TRIP_WINDOW_DAYS = 14;
const SAVED_PLACE_WINDOW_DAYS = 14;
const UPCOMING_TRIPS_LIMIT = 20;
const SAVED_TRIPS_LIMIT = 10;
const SAVED_PLACES_LIMIT = 10;

function daysBetween(fromIso: string, toDateOnly: string): number {
  const from = new Date(fromIso);
  from.setHours(0, 0, 0, 0);
  const to = new Date(`${toDateOnly}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

async function getUpcomingTripActivities(supabase: SupabaseClient, userId: string): Promise<ActivityItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,calendar_date,destination_image_url,created_at,is_saved")
    .eq("user_id", userId)
    .eq("is_saved", true)
    .not("final_itinerary", "is", null)
    .not("calendar_date", "is", null)
    .gte("calendar_date", today)
    .order("calendar_date", { ascending: true })
    .limit(UPCOMING_TRIPS_LIMIT);

  const rows = (data ?? []) as TripSessionRow[];
  const nowIso = new Date().toISOString();
  const items: ActivityItem[] = [];

  for (const row of rows) {
    if (!row.calendar_date) continue;
    const daysUntil = daysBetween(nowIso, row.calendar_date);
    const milestone = milestoneForDaysUntil(daysUntil);
    if (!milestone) continue;
    const dest = tripDestinationLabel(row);
    items.push({
      id: `trip_upcoming:${row.id}:${milestone.label}`,
      category: "trips",
      priority: daysUntil <= 1 ? "important" : "normal",
      title: milestone.title,
      description: milestone.body(dest),
      imageUrl: tripImageUrl(row),
      icon: "🧳",
      actionUrl: tripResultPath(row.trip_type, row.id),
      actionLabel: "לצפייה בטיול",
      // *** timestamp: לא created_at (מתי נוצר הטיול) - זה "מתי קרה
      // האירוע" מבחינת המשתמש, וזה עכשיו (ככל שהטיול קרוב יותר, זה
      // "טרי" יותר) - לא תאריך יצירת הטיול המקורי שיכול להיות ישן.
      timestamp: nowIso,
      isRead: false, // מתמלא ב-mergeWithReadState
    });
  }
  return items;
}

async function getSavedTripActivities(supabase: SupabaseClient, userId: string): Promise<ActivityItem[]> {
  const sinceIso = new Date(Date.now() - SAVED_TRIP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,calendar_date,destination_image_url,created_at,is_saved")
    .eq("user_id", userId)
    .eq("is_saved", true)
    .not("final_itinerary", "is", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(SAVED_TRIPS_LIMIT);

  const rows = (data ?? []) as TripSessionRow[];
  return rows.map((row) => {
    const dest = tripDestinationLabel(row);
    return {
      id: `trip_saved:${row.id}`,
      category: "trips" as const,
      priority: "normal" as const,
      title: "הטיול נשמר בהצלחה ❤️",
      description: `"${dest}" נוסף לטיולים שלכם.`,
      imageUrl: tripImageUrl(row),
      icon: "❤️",
      actionUrl: tripResultPath(row.trip_type, row.id),
      actionLabel: "לצפייה בטיול",
      timestamp: row.created_at,
      isRead: false,
    };
  });
}

interface FavoriteRow {
  place_id: string;
  created_at: string;
}
interface PlaceLookupRow {
  id: string;
  name: string;
  image_urls: string[] | null;
}

async function getSavedPlaceActivities(supabase: SupabaseClient, userId: string): Promise<ActivityItem[]> {
  const sinceIso = new Date(Date.now() - SAVED_PLACE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("place_id,created_at")
    .eq("user_id", userId)
    .eq("status", "saved")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(SAVED_PLACES_LIMIT);

  const favRows = (favorites ?? []) as FavoriteRow[];
  if (favRows.length === 0) return [];

  const placeIds = favRows.map((f) => f.place_id);
  const { data: places } = await supabase.from("places").select("id,name,image_urls").in("id", placeIds);
  const placeById = new Map<string, PlaceLookupRow>((places ?? []).map((p) => [p.id as string, p as PlaceLookupRow]));

  return favRows
    .map((fav): ActivityItem | null => {
      const place = placeById.get(fav.place_id);
      if (!place) return null;
      return {
        id: `favorite_saved:${fav.place_id}`,
        category: "trips" as const,
        priority: "normal" as const,
        title: "מקום ששמרת ❤️",
        description: `שמרתם את "${place.name}" למועדפים שלכם.`,
        imageUrl: place.image_urls?.[0] ?? null,
        icon: "📍",
        actionUrl: `/place/${place.id}`,
        actionLabel: "לצפייה במקום",
        timestamp: fav.created_at,
        isRead: false,
      } satisfies ActivityItem;
    })
    .filter((x): x is ActivityItem => x !== null);
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string | null;
  priority: "normal" | "important" | "urgent";
  action_url: string | null;
  action_label: string | null;
  published_at: string;
}

async function getPersistentNotifications(supabase: SupabaseClient): Promise<ActivityItem[]> {
  // *** RLS כבר מגבילה לגלובליות+אישיות פעילות/בתוקף (ר' migration 0059) -
  // לא צריך לסנן שוב כאן, ה-select הרגיל (לא admin client) מספיק.
  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,description,image_url,icon,priority,action_url,action_label,published_at")
    .order("published_at", { ascending: false })
    .limit(30);

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: `notif:${row.id}`,
    // *** תמיכה עתידית ב-TYPE 6 (המלצות, MASTER PROMPT סעיף 18): type
    // בטבלה יכול להיות "recommendation" בעתיד - כרגע כל השורות type
    // הן "system" (רק Admin), אבל המיפוי כבר גמיש ולא דורש שינוי מבני
    // כשמנגנון ההמלצות האוטומטי יגיע.
    category: row.type === "recommendation" ? ("recommendations" as const) : ("system" as const),
    priority: row.priority,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    icon: row.icon ?? "📢",
    actionUrl: row.action_url,
    actionLabel: row.action_label,
    timestamp: row.published_at,
    isRead: false,
  }));
}

const PRIORITY_WEIGHT: Record<ActivityItem["priority"], number> = { urgent: 2, important: 1, normal: 0 };

function sortActivities(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/** שולף את כל הפעילות (מחושבת + Admin), מחיל מצב read/unread אמיתי מ-
 *  notification_reads, וממיין. זו נקודת הכניסה היחידה שגם /api/notifications
 *  וגם ה-badge בפעמון (unread count) משתמשים בה - כדי שלא יהיו שני
 *  מקורות-אמת נפרדים שעלולים להתבדר. */
export async function getActivityFeed(
  supabase: SupabaseClient,
  userId: string,
  tab: ActivityTab = "all"
): Promise<{ items: ActivityItem[]; unreadCount: number }> {
  const [upcoming, savedTrips, savedPlaces, persistent] = await Promise.all([
    getUpcomingTripActivities(supabase, userId),
    getSavedTripActivities(supabase, userId),
    getSavedPlaceActivities(supabase, userId),
    getPersistentNotifications(supabase),
  ]);

  const all = [...upcoming, ...savedTrips, ...savedPlaces, ...persistent];

  const { data: reads, error: readsError } = await supabase
    .from("notification_reads")
    .select("activity_key")
    .eq("user_id", userId)
    .in(
      "activity_key",
      all.map((a) => a.id)
    );
  // *** תיקון (בקשת המשתמש - "המספר עדיין נשאר!!!"): אם השאילתה הזו
  // נכשלת (למשל migration 0059 לא רץ, notification_reads לא קיימת) -
  // לפני זה זה נבלע בשקט ל-Set ריק (readKeys), כלומר "שום דבר לא
  // נקרא" - בדיוק התסמין שדווח (המספר לא יורד לעולם, בכל טעינה
  // מחדש). עדיין נופלים בחזרה ל-"לא נקרא" (עדיף מקריסה), אבל עכשיו
  // לפחות רושמים ללוג השרת כדי שאפשר יהיה לאבחן את זה.
  if (readsError) {
    console.error("[notificationsService] שליפת notification_reads נכשלה", { message: readsError.message });
  }
  const readKeys = new Set((reads ?? []).map((r) => r.activity_key as string));

  const withReadState = all.map((item) => ({ ...item, isRead: readKeys.has(item.id) }));
  const unreadCount = withReadState.filter((i) => !i.isRead).length;

  const filtered = tab === "all" ? withReadState : withReadState.filter((i) => i.category === tab);

  return { items: sortActivities(filtered), unreadCount };
}

export async function markActivityRead(supabase: SupabaseClient, userId: string, activityKey: string): Promise<{ ok: boolean; error?: string }> {
  // *** תיקון (בקשת המשתמש - "המספר עדיין נשאר!!!"): לפני זה, שגיאת
  // DB כאן (למשל אם migration 0059 לא רץ ב-Supabase, והטבלה
  // notification_reads בכלל לא קיימת) הייתה נבלעת בשקט - ה-API עדיין
  // החזיר success:true, כאילו הכל תקין, בזמן שבפועל שום דבר לא נשמר.
  // זה בדיוק מצב שבו "לחצתי, כלום לא קרה בפועל" - נראה שזה עובד
  // (הלקוח מעדכן את המסך מקומית), אבל בכל טעינה מחדש מהשרת חוזר
  // "לא נקרא" כי שום דבר לא נשמר באמת. עכשיו מחזירים את התוצאה
  // האמיתית (כולל הודעת שגיאה) כדי שה-route יוכל לדווח את זה בבירור.
  const { error } = await supabase.from("notification_reads").upsert({ user_id: userId, activity_key: activityKey }, { onConflict: "user_id,activity_key" });
  if (error) {
    console.error("[notificationsService] markActivityRead נכשל", { activityKey, message: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function markActivitiesRead(supabase: SupabaseClient, userId: string, activityKeys: string[]): Promise<{ ok: boolean; error?: string }> {
  if (activityKeys.length === 0) return { ok: true };
  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      activityKeys.map((key) => ({ user_id: userId, activity_key: key })),
      { onConflict: "user_id,activity_key" }
    );
  if (error) {
    console.error("[notificationsService] markActivitiesRead נכשל", { count: activityKeys.length, message: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
