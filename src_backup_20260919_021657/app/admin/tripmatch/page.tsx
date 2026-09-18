import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function TripMatchAdminPage() {
  return (
    <ComingSoonPage
      title="ניהול TripMatch"
      description="שליטה מלאה בכרטיסי ה-Swipe שמוצגים למשתמשים."
      points={[
        "בחירת כרטיסים לפי מדינה, עיר, סוג טיול, תחומי עניין ותקציב",
        "התאמה לפי Travel DNA, מזג אוויר ושעת היום",
        "קביעת עדיפות והסתרת כרטיסים",
        "העלאת תמונות ועריכת תוכן",
      ]}
    />
  );
}
