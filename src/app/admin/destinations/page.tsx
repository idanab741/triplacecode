import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function DestinationsPage() {
  return (
    <ComingSoonPage
      title="יעדים ומדינות"
      description="ניהול מלא של מדינות, אזורים, ערים ויעדים - באותה רמת פירוט כמו מקומות ואטרקציות."
      points={[
        "יצירה/עריכה/מחיקה/שכפול/ארכוב/פרסום לכל ישות",
        "כל השדות: תיאורים (כולל תיאור ל-AI), תמונות, קואורדינטות, עונות מומלצות",
        "Workflow סטטוסים: Draft → Review → Approved → Published",
        "התאמת סוג טיול, תגיות ורמת עדיפות",
      ]}
    />
  );
}
