import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { getUserFullDetail } from "@/services/admin/userDetailService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מברחת ערך בודד לתא CSV תקין (RFC 4180) - עוטפת בגרשיים אם יש בו
 *  פסיק/גרש/ירידת שורה, ומכפילה גרשיים פנימיים. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}
function sectionHeader(title: string): string {
  return `\r\n=== ${title} ===\r\n`;
}

/**
 * Export User Data - כל המידע שה-Admin מורשה לקבל על המשתמש (ר' דרישה
 * מפורשת #26), בפורמט CSV (נפתח נכון ב-Excel/Google Sheets ללא תלות
 * חיצונית). *** לגבי .xlsx: זה מצריך ספריית npm ייעודית (למשל `xlsx`)
 * שלא ניתן לוודא שמותקנת בפרויקט מתוך קוד המקור בלבד - ר' סיכום.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId } = await params;

  const supabase = createAdminClient();
  const d = await getUserFullDetail(supabase, userId);
  if (!d) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  let csv = "\uFEFF"; // BOM - כדי ש-Excel יזהה UTF-8 (עברית) נכון

  csv += sectionHeader("Account");
  csv += csvRow(["User ID", "Email", "Full Name", "City", "Country", "Age", "Anonymous", "Banned", "Signup Date", "Last Login"]);
  csv += csvRow([d.account.id, d.account.email, d.account.fullName, d.account.city, d.account.country, d.account.age, d.account.isAnonymous, d.account.isBanned, d.account.signupDate, d.account.lastLogin]);

  csv += sectionHeader("Onboarding");
  csv += csvRow(["Main Onboarding", "TripMatch Onboarding", "Trip Building Onboarding", "Preferences Onboarding"]);
  csv += csvRow([d.account.onboarding.main, d.account.onboarding.tripmatch, d.account.onboarding.tripbuilding, d.account.onboarding.preferences]);

  if (d.preferences) {
    csv += sectionHeader("Preferences");
    for (const [key, value] of Object.entries(d.preferences)) {
      if (key === "id" || key === "created_at" || key === "updated_at") continue;
      csv += csvRow([key, Array.isArray(value) ? value.join(" | ") : value]);
    }
  }

  if (d.travelDna) {
    csv += sectionHeader("Travel DNA");
    csv += csvRow(["Preferred Categories", d.travelDna.preferred_categories?.join(" | ") ?? ""]);
    csv += csvRow(["Disliked Categories", d.travelDna.disliked_categories?.join(" | ") ?? ""]);
  }

  csv += sectionHeader("Free Text (Trippy AI)");
  csv += csvRow(["Text", "Screen", "Result Title", "Date"]);
  for (const f of d.freeText) csv += csvRow([f.text, f.screen, f.resultTitle, f.createdAt]);

  csv += sectionHeader("Trips");
  csv += csvRow(["ID", "Trip Type", "Destination", "Saved", "Created", "Updated"]);
  for (const t of d.trips.built) csv += csvRow([t.id, t.tripType, t.destination, t.isSaved, t.createdAt, t.updatedAt]);

  csv += sectionHeader("Likes");
  csv += csvRow(["Place", "Category", "City", "Country", "Date"]);
  for (const l of d.likes) csv += csvRow([l.name, l.category, l.city, l.country, l.createdAt]);

  csv += sectionHeader("Saves");
  csv += csvRow(["Place", "Category", "City", "Country", "Date"]);
  for (const s of d.saves) csv += csvRow([s.name, s.category, s.city, s.country, s.createdAt]);

  csv += sectionHeader("TripMatch Activity");
  csv += csvRow(["Sessions", "Cards Viewed", "Swipe Right", "Swipe Left", "Matches", "Cities", "Categories"]);
  csv += csvRow([d.tripMatch.sessionsCount, d.tripMatch.cardsViewed, d.tripMatch.swipeRight, d.tripMatch.swipeLeft, d.tripMatch.matches, d.tripMatch.cities.join(" | "), d.tripMatch.categories.join(" | ")]);

  csv += sectionHeader("Trippy AI Usage");
  csv += csvRow(["Results Count", "Last Used"]);
  csv += csvRow([d.trippyAi.resultsCount, d.trippyAi.lastUsed]);

  if (d.tokens) {
    csv += sectionHeader("Tokens (טריפים)");
    csv += csvRow(["Balance", "Cycle Start"]);
    csv += csvRow([d.tokens.balance, d.tokens.cycleStart]);
  }

  csv += sectionHeader("Notifications");
  csv += csvRow(["Title", "Description", "Read", "Published At"]);
  for (const n of d.notifications.items) csv += csvRow([n.title, n.description, n.isRead, n.publishedAt]);

  csv += sectionHeader("Support");
  csv += csvRow(["Conversations Count", "Last Status", "Last Message", "Last Message From"]);
  csv += csvRow([d.support.conversationsCount, d.support.lastStatus, d.support.lastMessage?.message ?? "", d.support.lastMessage?.senderType ?? ""]);

  csv += sectionHeader("Activity Timeline");
  csv += csvRow(["Date", "Type", "Title", "Subtitle", "Source"]);
  for (const e of d.activityTimeline) csv += csvRow([e.timestamp, e.type, e.title, e.subtitle, e.source]);

  const filename = `triplace-user-${d.account.email || d.account.id}.csv`.replace(/[^a-zA-Z0-9@._-]/g, "_");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
