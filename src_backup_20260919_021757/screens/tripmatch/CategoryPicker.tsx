"use client";

import { ImageOptionRow } from "@/components/ui";
import { TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";

interface CategoryPickerProps {
  onSelect: (categoryValue: string, categoryLabel: string) => void;
  /** "אחר" - בחירה ידנית מתוך כל תתי-הקטגוריות (התאמות אישיות), לא רק אחד מ-4 הדליים. */
  onOther: () => void;
}

/** שלב 2 - בחירת אחת מ-4 הקטגוריות הראשיות (מסעדות/חיי לילה/טבע/אטרקציות),
 *  ועוד אפשרות "אחר" (בחירה ידנית). "קרוב אליי" עבר לעמוד הקודם (בחירת
 *  יעד) - הוא לא תלוי בעיר שכבר הוזנה, אלא קובע את היעד לפי ה-GPS בעצמו.
 *
 *  לפני התיקון הזה הוצגה כאן רשימה שטוחה של 19 תת-קטגוריות - זה עבר
 *  לפילטרים בתוך ההחלקות (FiltersSheet), כדי שהבחירה הראשונית תהיה
 *  פשוטה, ושהתוצאות תמיד יהיו מהקטגוריה הנכונה בלבד (לא עוד מלונות
 *  שמתערבבים במסעדות וכו').
 *
 *  אותו קומפוננט צ'יפ בדיוק (ImageOptionRow) כמו בעמוד ההתאמה האישית
 *  ("סגנון קולינרי" וכו') - צ'יפ שמתאים את עצמו לתוכן ונשבר לשורות
 *  (flex-wrap), לא כרטיסים גדולים בגריד קבוע. */
export function CategoryPicker({ onSelect, onOther }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {TRIPMATCH_CATEGORY_BUCKETS.map((bucket) => (
        <ImageOptionRow
          key={bucket.value}
          selected={false}
          onClick={() => onSelect(bucket.value, bucket.label)}
          label={bucket.label}
          imageSrc={bucket.imageSrc}
        />
      ))}

      <ImageOptionRow
        selected={false}
        onClick={onOther}
        label="אחר"
        imageSrc="/images/tripmatch/action-other.png"
      />
    </div>
  );
}
