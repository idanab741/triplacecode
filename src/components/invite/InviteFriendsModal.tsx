"use client";

import type { MouseEvent } from "react";
import { InviteFriendsCard } from "./InviteFriendsCard";

interface InviteFriendsModalProps {
  onClose: () => void;
}

/**
 * פופאפ "הזמן חברים" - נפתח מעל המסך הנוכחי (לא ניווט לעמוד חדש), באותו
 * מבנה בדיוק כמו LikedDialog.tsx: backdrop כהה+blur, כרטיס לבן במרכז,
 * סגירה בלחיצה על הרקע או על כפתור ה-X.
 */
export function InviteFriendsModal({ onClose }: InviteFriendsModalProps) {
  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm">
        <InviteFriendsCard onClose={onClose} />
      </div>
    </div>
  );
}
