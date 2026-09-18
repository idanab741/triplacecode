import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function RoutesPage() {
  return (
    <ComingSoonPage
      title="מסלולים מוכנים"
      description="ניהול מסלולים מוכנים מראש שהמשתמשים יכולים לבחור."
      points={[
        "יצירה/עריכה/שכפול/מחיקה/ארכוב/פרסום",
        "נעיצה והגדרה כמומלץ",
        "שיוך למדינה, עיר, סוג טיול, תחומי עניין, תקציב ורמת קושי",
        "תצוגה מקדימה זהה למה שהמשתמש יראה באפליקציה",
      ]}
    />
  );
}
