import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function LearningPage() {
  return (
    <ComingSoonPage
      title="מערכת Learning"
      description="ניתוח אוטומטי של התנהגות משתמשים וזיהוי דפוסים."
      points={[
        "זיהוי אילו אטרקציות זוגות/משפחות/צעירים בוחרים",
        "תקציב ממוצע לכל סוג טיול, ושילובי קטגוריות חוזרים",
        "זיהוי משתמשים שנוטשים באמצע בניית מסלול",
        "תובנות עסקיות והמלצות שיפור שנוצרות אוטומטית ע\"י AI",
      ]}
    />
  );
}
