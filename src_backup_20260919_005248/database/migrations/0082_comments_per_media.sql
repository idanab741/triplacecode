-- ========================================================================
-- Migration 0082: תגובות לפי תמונה בתוך פוסט (לא רק לפי פוסט כולו)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תוספת (בקשה מפורשת - "אם יש כמה תמונות בפוסט, שלכל תמונה יהיו
-- תגובות משלה, עם מספר משלה"): comments.media_id חדש, **nullable
-- בכוונה** - שתי המשמעויות חיות יחד באותה טבלה בלי טבלה נפרדת:
--  - media_id = NULL  -> תגובה כללית על הפוסט עצמו (זה מה שנפתח
--    "מתחת לשורה" בפיד כשלוחצים על כפתור "תגובה"/מספר התגובות).
--  - media_id = <id>  -> תגובה על תמונה ספציפית בתוך הפוסט (זה מה
--    שנפתח בתוך חלון-הצפייה בתמונה, ומתחלף כשמחליקים בין תמונות).
-- הפרדה בין השניים - לא מיזוג - כי אלה שני הקשרים שונים לגמרי
-- (בקשה מפורשת: קליק על תמונה != קליק על "תגובה").
-- media_id מצביע ל-media_assets.id (לא ל-post_media, שאין לה כלל
-- עמודת id עצמאית - primary key שלה הוא הזוג post_id+media_id).
-- ========================================================================

alter table public.comments
  add column media_id uuid references public.media_assets (id) on delete cascade;

create index comments_media_id_idx on public.comments (media_id) where deleted_at is null and media_id is not null;

comment on column public.comments.media_id is
  'NULL = תגובה כללית על הפוסט. לא-NULL = תגובה על תמונה/מדיה ספציפית בתוך הפוסט (media_assets.id).';
