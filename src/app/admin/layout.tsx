import "@/styles/admin-tokens.css";
import type { ReactNode } from "react";
import { AdminShell } from "@/screens/admin/shell/AdminShell";
import { AdminAuthProvider } from "@/screens/admin/shell/AdminAuthContext";
import { AdminAuthGate } from "@/screens/admin/shell/AdminAuthGate";

export const metadata = {
  title: "TRIPLACE Control Center",
};

/** כל מסך תחת /admin/* עובר דרך ה-Shell: סיידבר עם מונים חיים, כותרת עם
 *  חיפוש גלובלי (⌘K) ומצב כהה. הכניסה מאומתת מול השרת פעם אחת בלבד. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminAuthGate>
        <AdminShell>{children}</AdminShell>
      </AdminAuthGate>
    </AdminAuthProvider>
  );
}
