-- ========================================================================
-- Migration 0077: place_submissions - דירוג, קטגוריית "קניות ושופינג",
-- ועמודות השלמה אוטומטית (AI + Google) שממולאות רק אחרי השמירה
--
-- הקשר: כפתור ה-(+) הצף מעל המפה בעמוד הבית - "הוספת מקום". 6
-- הקטגוריות הראשיות שסוכמו (מסעדות וקולינריה/אטרקציות וחוויות/טבע
-- ונופים/קניות ושופינג/לינה/חיי לילה ובילויים) מוסיפות ל-5 הקיימות
-- (restaurant/attraction/nature/hotel/nightlife) רק את "shopping" -
-- שאר 5 הערכים כבר תואמים במלואם, לא נבנה enum חדש.
--
-- rating: 1-5 כוכבים, נכתב ע"י המשתמש עצמו בטופס (סעיף 6 בפרומפט).
-- subcategory/accessible/price_level/phone/short_description/
-- opening_hours: ממולאים **רק** אחרי "שמור מקום" ע"י תהליך השלמה
-- נפרד (AI לסיווג תת-קטגוריה, Google Places לעובדות זמינות) - לא
-- שדות שהמשתמש ממלא בטופס עצמו (סעיף 7-8 בפרומפט: "אין להעמיס את
-- הנתונים האלה בתוך טופס ההוספה").
-- ========================================================================

alter table public.place_submissions
  drop constraint if exists place_submissions_category_check;

alter table public.place_submissions
  add constraint place_submissions_category_check
    check (category in ('restaurant', 'attraction', 'nature', 'nightlife', 'hotel', 'shopping'));

alter table public.place_submissions
  add column if not exists rating smallint,
  add column if not exists subcategory text,
  add column if not exists accessible boolean,
  add column if not exists price_level smallint,
  add column if not exists phone text,
  add column if not exists short_description text,
  add column if not exists opening_hours text[],
  add column if not exists enrichment_status text not null default 'pending';

alter table public.place_submissions
  add constraint place_submissions_rating_check
    check (rating is null or (rating >= 1 and rating <= 5));

alter table public.place_submissions
  add constraint place_submissions_enrichment_status_check
    check (enrichment_status in ('pending', 'done', 'failed', 'skipped'));

comment on column public.place_submissions.rating is 'דירוג 1-5 כוכבים שהמשתמש עצמו נתן בטופס ההוספה - לא מגיע מ-AI/Google';
comment on column public.place_submissions.subcategory is 'תת-קטגוריה שנגזרת ע"י AI אחרי השמירה (למשל "בית קפה" תחת מסעדות וקולינריה) - לא נבחר ע"י המשתמש';
comment on column public.place_submissions.enrichment_status is 'סטטוס תהליך ההשלמה שרץ אחרי השמירה (AI + Google) - pending עד שהוא רץ בפועל';
