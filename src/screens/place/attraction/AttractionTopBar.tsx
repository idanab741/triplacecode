"use client";

import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";

/** הבר העליון הרגיל של triplace (חזור · לוגו שחור · התראות) - אותו בר כמו בשאר העמודים,
 *  לבן ונקי, מעל התמונה ולא עליה. */
export function AttractionTopBarPlain({ backHref }: { backHref?: string }) {
  return (
    <CollapsibleTopBar
      onBack={() => {
        if (backHref) window.location.href = backHref;
        else if (window.history.length > 1) window.history.back();
        else window.location.href = "/home";
      }}
    />
  );
}
