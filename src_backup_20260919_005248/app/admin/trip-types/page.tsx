import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function TripTypesPage() {
  return (
    <ComingSoonPage
      title="סוגי טיולים"
      description="ניהול כל סוגי הטיולים באפליקציה וחלוקת התוכן שלהם."
      points={[
        "מסך ניהול ייעודי לכל סוג טיול - קטגוריות, תגיות מותרות, אטרקציות מתאימות",
        "קביעת חלוקת תוכן ויזואלית: כמה אטרקציות/מסעדות/תצפיות בכל מסלול",
        "התאמה לפי סוג טיול: יומי, זוגי, משפחתי ועוד",
        "ללא צורך בשינוי קוד - הכל דרך ממשק גרפי",
      ]}
    />
  );
}
