"use client";

import { useEffect, useState } from "react";
import { ChipGroup } from "@/components/ui";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

interface Friend {
  id: string;
  label: string;
}

interface FilterModalProps {
  onClose: () => void;
  selectedPeople: string[];
  selectedCategories: string[];
  onChangePeople: (ids: string[]) => void;
  onChangeCategories: (ids: string[]) => void;
}

/**
 * *** ממשק סינון (סעיף 9-11 בפרומפט) - אנשים (מרשימת ה-friends
 * האמיתית של המשתמש, /api/social/friends הקיים - לא רשימה מזויפת)
 * + קטגוריות (6 הקטגוריות שכבר קיימות בשורת סוגי הטיול בעמוד הבית -
 * ChipGroup הקיים, לא רכיב בחירה חדש). שינוי כל צ'יפ מעדכן את ה-state
 * מיד (ר' page.tsx - הבחירות מופעלות מיידית על מרקרי המפה, בלי
 * reload). "נקה הכל" מאפס את שני הסטים.
 */
export function FilterModal({ onClose, selectedPeople, selectedCategories, onChangePeople, onChangeCategories }: FilterModalProps) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendsError, setFriendsError] = useState(false);

  useEffect(() => {
    fetch("/api/social/friends")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.friends ?? []) as { friend: { id: string; full_name?: string | null; username?: string | null } }[];
        setFriends(list.map((f) => ({ id: f.friend.id, label: f.friend.full_name || f.friend.username || "משתמש" })));
      })
      .catch(() => setFriendsError(true));
  }, []);

  const categoryOptions = HOME_QUICK_CATEGORIES.map((c) => ({
    value: c.id,
    label: HOME_QUICK_CATEGORY_LABELS[c.id],
    imageSrc: c.imageSrc,
  }));

  const activeCount = selectedPeople.length + selectedCategories.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft" style={{ borderRadius: 22 }}>
        <div className="flex items-center justify-between border-b border-ink-secondary/10 px-4 py-3">
          <h2 className="text-[16px] font-bold text-ink">סינון</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-secondary text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-4">
          <label className="mb-2 block text-[12.5px] font-semibold text-ink-secondary">אנשים</label>
          {friendsError && <p className="text-[12.5px] text-ink-secondary">לא הצלחנו לטעון את רשימת החברים שלך.</p>}
          {!friendsError && friends === null && <p className="text-[12.5px] text-ink-secondary">טוען...</p>}
          {friends !== null && friends.length === 0 && (
            <p className="text-[12.5px] text-ink-secondary">אין לך עדיין חברים במערכת - ברגע שיהיו, תוכל לסנן לפיהם כאן.</p>
          )}
          {friends !== null && friends.length > 0 && (
            <ChipGroup
              options={friends.map((f) => ({ value: f.id, label: f.label }))}
              selected={selectedPeople}
              onChange={onChangePeople}
            />
          )}

          <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">קטגוריות</label>
          <ChipGroup options={categoryOptions} selected={selectedCategories} onChange={onChangeCategories} />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangePeople([]);
                onChangeCategories([]);
              }}
              className="mt-5 w-full rounded-pill border border-ink-secondary/20 py-2.5 text-[13px] font-semibold text-ink-secondary"
            >
              נקה הכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
