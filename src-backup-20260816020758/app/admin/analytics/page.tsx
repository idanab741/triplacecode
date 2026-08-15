import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function AnalyticsPage() {
  return (
    <ComingSoonPage
      title="אנליטיקות"
      description="פילוח עומק לכל נתון באפליקציה, עם Drill Down אינטראקטיבי."
      points={[
        "פילוח לפי תאריך, מדינה, עיר, סוג טיול, גיל, סוג מנוי ומקור הרשמה",
        "פילוח לפי Travel DNA, תחומי עניין ותקציב",
        "גרפים אינטראקטיביים עם Drill Down לנתונים מפורטים",
        "ייצוא דוחות מותאמים אישית",
      ]}
    />
  );
}
