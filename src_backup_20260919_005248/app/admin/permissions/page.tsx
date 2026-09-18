import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function PermissionsPage() {
  return (
    <ComingSoonPage
      title="הרשאות וצוות"
      description="ניהול תפקידים והרשאות לכל חברי צוות האדמין."
      points={[
        "תפקידים: Super Admin, Admin, Editor, Content Manager, Support, Viewer",
        "הרשאות עדינות לכל מסך ולכל פעולה",
        "היסטוריית פעולות לפי משתמש",
        "הזמנת חברי צוות חדשים",
      ]}
    />
  );
}
