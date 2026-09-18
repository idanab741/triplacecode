-- ========================================================================
-- Migration 0087: מעקב מצב-התאמה של גוגל (silent matching)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תוספת (בקשה מפורשת - מסמך העדכון, סעיפים 2-7,21,29): ה-matching
-- מול גוגל קורה עכשיו מאחורי הקלעים (לא autocomplete גלוי) - יש
-- לעקוב אחרי *תוצאת* ההתאמה בנפרד מהעובדה שיש google_place_id (שכבר
-- קיים). google_match_status מאפשר בעתיד תור ל-Admin (סעיף 7,28 -
-- לא נבנה בסבב הזה, רק העמודות שיאפשרו את זה בלי migration נוספת).
-- ========================================================================

alter table public.tripadd_submissions
  add column if not exists google_match_status text check (google_match_status in ('matched', 'unmatched', 'manual', 'rejected')),
  add column if not exists google_match_confidence numeric(3, 2);

comment on column public.tripadd_submissions.google_match_status is
  'matched = נמצאה התאמה אוטומטית (לא עדיין מאומתת ע"י Admin); unmatched = לא נמצאה התאמה, המשתמש המשיך עם כתובת/מיקום ידני; manual = Admin קבע התאמה ידנית; rejected = Admin דחה התאמה קיימת. null = ישן, מלפני המיגרציה הזו.';
comment on column public.tripadd_submissions.google_match_confidence is
  '0.00-1.00, הערכה גסה בלבד (לא ציון AI מתוחכם בשלב הזה) - לא מוצג למשתמש, רק לשימוש פנימי/עתידי ב-Admin queue.';
