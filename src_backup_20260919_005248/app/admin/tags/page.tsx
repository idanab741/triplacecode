import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function TagsPage() {
  return (
    <ComingSoonPage
      title="מערכת תגיות"
      description="מערכת תגיות מרכזית ומשותפת לכל התוכן באפליקציה."
      points={[
        "יצירה/עריכה/מחיקה של תגיות, ללא הגבלת כמות לכל ישות",
        "חיבור לכל הקטגוריות: סוגי טיולים, תחומי עניין, תקציב, עונות ועוד",
        "שימוש חוזר בין מקומות, מסעדות, יעדים ומסלולים",
        "תצוגת שימוש - כמה ישויות משתמשות בכל תגית",
      ]}
    />
  );
}
