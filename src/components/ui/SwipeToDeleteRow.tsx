"use client";

import type { ReactNode } from "react";
import { SwipeActionsRow, type SwipeAction } from "./SwipeActionsRow";

interface SwipeToDeleteRowProps {
  onDelete: () => void;
  children: ReactNode;
  resetKey?: string;
  /** פעולות נוספות בהחלקה שמאלה (יומן / הוספה ל...) */
  actions?: SwipeAction[];
}

/**
 * *** בקשה מפורשת ("שיטת החלקות בשורה - ימינה מחיקה, שמאלה יומן והוספה"): כל הרשימות עם מחיקה
 * בהחלקה עברו לשיטה החדשה (SwipeActionsRow) - החלקה ימינה חושפת "הסרה", ושמאלה את הפעולות.
 * נשאר כעטיפה כדי שכל השימושים הקיימים יקבלו את ההתנהגות החדשה בלי לשנות אותם.
 */
export function SwipeToDeleteRow({ onDelete, children, resetKey, actions }: SwipeToDeleteRowProps) {
  return (
    <SwipeActionsRow onDelete={onDelete} actions={actions} resetKey={resetKey} className="rounded-2xl">
      {children}
    </SwipeActionsRow>
  );
}
