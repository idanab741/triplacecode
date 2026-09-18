-- ========================================================================
-- Migration 0085: עוד 3 עובדות נגישות מגוגל (מעבר לכניסה נגישה שכבר יש)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תוספת (בקשה מפורשת - "נגישות = מה שיש בגוגל"): Google Places API
-- מספק בפועל 4 עובדות נגישות בלבד (לא 10 - זו המגבלה האמיתית של
-- המקור, לא בחירה שלנו): כניסה נגישה (accessible - כבר קיים),
-- חניה נגישה, שירותים נגישים, ואזור ישיבה נגיש. שלוש הבאות מתווספות
-- כאן. כל השדות nullable כמו accessible הקיים - null = "לא ידוע",
-- לא "לא נגיש" (לא ממציאים נתון שאין).
-- ========================================================================

alter table public.tripadd_submissions
  add column if not exists accessible_parking boolean,
  add column if not exists accessible_restroom boolean,
  add column if not exists accessible_seating boolean;

comment on column public.tripadd_submissions.accessible_parking is 'חניה נגישה (Google accessibilityOptions.wheelchairAccessibleParking) - null=לא ידוע';
comment on column public.tripadd_submissions.accessible_restroom is 'שירותים נגישים (Google accessibilityOptions.wheelchairAccessibleRestroom) - null=לא ידוע';
comment on column public.tripadd_submissions.accessible_seating is 'אזור ישיבה נגיש (Google accessibilityOptions.wheelchairAccessibleSeating) - null=לא ידוע';
