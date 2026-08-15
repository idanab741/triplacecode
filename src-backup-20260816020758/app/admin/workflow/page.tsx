import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function WorkflowPage() {
  return (
    <ComingSoonPage
      title="Workflow ואישורים"
      description="מעקב סטטוס תוכן והיסטוריית שינויים מלאה."
      points={[
        "סטטוסים: Draft, Review, Approved, Published, Archived",
        "היסטוריית שינויים מלאה - מי ערך כל שדה ומתי",
        "תור אישורים לתוכן חדש",
        "התראות על תוכן שממתין לבדיקה",
      ]}
    />
  );
}
