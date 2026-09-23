import { redirect } from "next/navigation";

/** נקודת הכניסה לאפליקציה: פתיחה ב-"/" נוחתת תמיד בעמוד הבית (/home).
 *  (משתמש שלא מחובר מופנה משם ל-/auth ע"י proxy.ts, כמו לכל עמוד מוגן.) */
export default function RootPage() {
  redirect("/home");
}
