import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function NotificationsAdminPage() {
  return (
    <ComingSoonPage
      title="התראות מערכת"
      description="זיהוי אוטומטי של בעיות ותוכן חסר במערכת."
      points={[
        "אטרקציות ללא תמונות, יעדים ללא תיאור, קטגוריות ריקות",
        "מסלולים שאינם עומדים בכללי החלוקה שהוגדרו",
        "נתונים חסרים בכל ישות",
        "מרכז התראות עם סימון \"טופל\"",
      ]}
    />
  );
}
