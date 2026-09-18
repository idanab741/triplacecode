import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function HotDestinationsPage() {
  return (
    <ComingSoonPage
      title="יעדים חמים"
      description="ניהול היעדים המוצגים במסך הבית של האפליקציה."
      points={[
        "בחירת יעדים לפי מדינה, סוג טיול וסדר תצוגה",
        "הגבלת זמן ותאריכים לכל יעד",
        "קמפיינים עונתיים ויעדים מקודמים",
        "תצוגה מקדימה של מסך הבית בזמן אמת",
      ]}
    />
  );
}
