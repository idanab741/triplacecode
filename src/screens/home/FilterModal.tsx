"use client";

import { useEffect, useState } from "react";
import { ChipGroup } from "@/components/ui";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

interface Friend {
  id: string;
  label: string;
}

/** *** מיפוי בין 6 הקטגוריות של שורת "סוגי הטיול" לבין places.category
 *  האמיתי - נדרש כאן כדי לשלוף תתי-קטגוריה אמיתיות לפי הקטגוריות
 *  שנבחרו (אותו מיפוי בדיוק כמו ב-page.tsx - לא כפילות לוגית, רק
 *  ערכי מחרוזת קבועים). */
const CATEGORY_TO_PLACE_CATEGORY: Record<string, string[]> = {
  attraction: ["attractions"],
  food: ["restaurants"],
  shopping: [],
  nature: ["nature"],
  nightlife: ["nightlife"],
  sleep: ["hotels"],
};

interface FilterModalProps {
  onClose: () => void;
  selectedPeople: string[];
  selectedCategories: string[];
  selectedSubcategories: string[];
  minRating: number;
  onChangePeople: (ids: string[]) => void;
  onChangeCategories: (ids: string[]) => void;
  onChangeSubcategories: (values: string[]) => void;
  onChangeMinRating: (value: number) => void;
}

/**
 * *** ממשק סינון (סעיף 9-11 בפרומפט + תוספת מפורשת - דירוג ותתי-
 * קטגוריה): אנשים (friends אמיתיים) + קטגוריות (6 הקטגוריות הקיימות)
 * + תתי-קטגוריה (אמיתיות, נגזרות מהדאטה בפועל לפי הקטגוריות שנבחרו -
 * לא רשימה קבועה מראש) + דירוג מינימלי. שינוי כל צ'יפ מעדכן מיד
 * (ר' page.tsx - חי, בלי reload). "נקה הכל" מאפס הכל.
 */
export function FilterModal({
  onClose,
  selectedPeople,
  selectedCategories,
  selectedSubcategories,
  minRating,
  onChangePeople,
  onChangeCategories,
  onChangeSubcategories,
  onChangeMinRating,
}: FilterModalProps) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendsError, setFriendsError] = useState(false);
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/social/friends")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.friends ?? []) as { friend: { id: string; full_name?: string | null; username?: string | null } }[];
        setFriends(list.map((f) => ({ id: f.friend.id, label: f.friend.full_name || f.friend.username || "משתמש" })));
      })
      .catch(() => setFriendsError(true));
  }, []);

  // *** תיקון (בקשה מפורשת - "תתי קטגוריות בהתאם לכל סוג"): נטען
  // מחדש בכל שינוי בקטגוריות שנבחרו - תתי-הקטגוריה תלויות בהן.
  useEffect(() => {
    const placeCategoryValues = Array.from(
      new Set(selectedCategories.flatMap((id) => CATEGORY_TO_PLACE_CATEGORY[id] ?? []))
    );
    const params = new URLSearchParams();
    if (placeCategoryValues.length > 0) params.set("categories", placeCategoryValues.join(","));
    fetch(`/api/map/category-subtypes?${params}`)
      .then((r) => r.json())
      .then((data) => setSubcategoryOptions(data.subcategories ?? []))
      .catch(() => setSubcategoryOptions([]));
  }, [selectedCategories]);

  const categoryOptions = HOME_QUICK_CATEGORIES.map((c) => ({
    value: c.id,
    label: HOME_QUICK_CATEGORY_LABELS[c.id],
    imageSrc: c.imageSrc,
  }));

  const activeCount = selectedPeople.length + selectedCategories.length + selectedSubcategories.length + (minRating > 0 ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft" style={{ borderRadius: 22 }}>
        <div className="flex shrink-0 items-center justify-between border-b border-ink-secondary/10 px-4 py-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
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

          {subcategoryOptions.length > 0 && (
            <>
              <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">תת-קטגוריה</label>
              <ChipGroup
                options={subcategoryOptions.map((s) => ({ value: s, label: s }))}
                selected={selectedSubcategories}
                onChange={onChangeSubcategories}
              />
            </>
          )}

          <label className="mb-2 mt-5 block text-[12.5px] font-semibold text-ink-secondary">דירוג מינימלי</label>
          <div className="flex gap-2">
            {[0, 3, 4, 4.5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeMinRating(minRating === r ? 0 : r)}
                className={`rounded-pill px-3.5 py-2 text-[13px] font-medium transition ${
                  minRating === r ? "text-white" : "bg-white text-ink"
                }`}
                style={
                  minRating === r
                    ? { background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }
                    : { boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }
                }
              >
                {r === 0 ? "הכל" : `${r}+ ⭐`}
              </button>
            ))}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangePeople([]);
                onChangeCategories([]);
                onChangeSubcategories([]);
                onChangeMinRating(0);
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
