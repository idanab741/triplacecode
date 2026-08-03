import "@/styles/admin-tokens.css";
import type { ReactNode } from "react";
import { AdminShell } from "@/screens/admin/shell/AdminShell";

export const metadata = {
  title: "TRIPLACE Admin",
};

/** כל מסך תחת /admin/* עובר דרך ה-Shell הזה - Sidebar קבוע + Header +
 *  אזור תוכן גלול. שפה עיצובית נפרדת לגמרי מהאפליקציה (ראו admin-tokens.css) -
 *  ה-<div dir="ltr"> כאן מבודד את זה מה-dir="rtl" הגלובלי שהאפליקציה
 *  משתמשת בו, כי ממשקי Admin ברוב מוצרי ה-SaaS (ואפילו בעברית) בנויים LTR. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
