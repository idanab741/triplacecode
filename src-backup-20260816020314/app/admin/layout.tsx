import "@/styles/admin-tokens.css";
import type { ReactNode } from "react";
import { AdminShell } from "@/screens/admin/shell/AdminShell";
import { AdminAuthProvider } from "@/screens/admin/shell/AdminAuthContext";
import { AdminAuthGate } from "@/screens/admin/shell/AdminAuthGate";

export const metadata = {
  title: "TRIPLACE Admin",
};

/** כל מסך תחת /admin/* עובר דרך ה-Shell הזה - Sidebar קבוע + Header +
 *  אזור תוכן גלול. שפה עיצובית נפרדת לגמרי מהאפליקציה (ראו admin-tokens.css) -
 *  ה-<div dir="ltr"> כאן מבודד את זה מה-dir="rtl" הגלובלי שהאפליקציה
 *  משתמשת בו, כי ממשקי Admin ברוב מוצרי ה-SaaS (ואפילו בעברית) בנויים LTR.
 *
 *  AdminAuthProvider+Gate עוטפים הכל פעם אחת כאן - סיסמת אדמין נשאלת רק
 *  פעם אחת בכניסה הראשונה (לא בכל עמוד בנפרד כמו קודם). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminAuthGate>
        <AdminShell>{children}</AdminShell>
      </AdminAuthGate>
    </AdminAuthProvider>
  );
}
