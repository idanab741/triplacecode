-- ========================================================================
-- Migration 0054: destination_editions.group_label
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- רקע ("לא!!!!!!!!!!!! זה צריך להיות זהה למלל בעמוד שלו בסוגי הטיול"):
-- מתברר ש"חופשה בחו"ל" ו"חופשה בארץ" באפליקציה בפועל הם לא רשימת יעדים
-- שטוחה - הם רשימה סטטית ומקובצת (16 קטגוריות כמו "בטן גב וחופים",
-- "קזינו והימורים" - ר' worldwideVacationCategories.ts /
-- israelVacationDestinations.ts). group_label מאפשר לשחזר את אותו מבנה
-- מקובץ באדמין (כותרת קבוצה מעל כמה כרטיסי יעד), במקום גריד שטוח אחד
-- שלא תואם את מה שבאמת מוצג למשתמש.
-- ========================================================================

alter table public.destination_editions
  add column if not exists group_label text;

comment on column public.destination_editions.group_label is
  'כותרת קבוצה לתצוגה מקובצת בעמוד Admin Places (למשל "בטן גב וחופים", "קזינו והימורים") - תואם את המבנה האמיתי של worldwideVacationCategories.ts / israelVacationDestinations.ts. NULL = מהדורה שנוצרה ידנית בלי קיבוץ, מוצגת בגריד השטוח הרגיל.';

-- *** בכוונה בלי unique constraint על (destination_id, quick_category,
-- group_label): לא ניתן להוסיף "add constraint if not exists" ב-Postgres,
-- ואם כבר נוצרו מהדורות ידנית לפני המיגרציה הזו, constraint קשיח היה
-- יכול להיכשל על דאטה קיימת. הדה-דופ נאכף באפליקציה (בדיקת קיום לפני
-- insert ב-/api/admin/destination-editions/import-curated), לא ב-DB.
