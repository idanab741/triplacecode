-- ========================================================================
-- Migration 0024: קרוסלת "יעדים חמים" - 14 היעדים האמיתיים עם התמונות
-- המקומיות שכבר קיימות ב-public/images/destinations/, ותיקון תקלה
-- שנגרמה ע"י 0023 (הפכה בטעות גם את "מיקונוס" הקיים ל-is_hot_destination=false,
-- כי migration 0021 דילג עליו - הוא כבר היה קיים - ואז 0023 תפס אותו
-- בטעות ברשימת ה"ערים החדשות שצריך לסמן false").
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- שני statement-ים נפרדים בכוונה (UPDATE ואז INSERT) - CTE לא נשמר בין
-- statement-ים נפרדים ב-Postgres.
-- ========================================================================

-- שלב א' - מעדכנים שורות קיימות (image_url + is_hot_destination=true)
update public.destinations d
set image_url = '/images/destinations/' || t.filename,
    is_hot_destination = true
from (values
  ('בוקרשט', 'bucharest.png'),
  ('בודפשט', 'budapest.png'),
  ('כרתים', 'crete.png'),
  ('ברצלונה', 'imgaebarcelona.png'),
  ('לונדון', 'london.png'),
  ('מיקונוס', 'mykonos.png'),
  ('ניו יורק', 'newyork.png'),
  ('פאפוס', 'papos.png'),
  ('פריז', 'paris.png'),
  ('פוקט', 'pocket.png'),
  ('פראג', 'prague.png'),
  ('רומא', 'rome.png'),
  ('טוקיו', 'tokio.png'),
  ('וינה', 'vienna.png')
) as t(name, filename)
where d.name = t.name;

-- שלב ב' - כל שם מתוך ה-14 שעדיין לא קיים בטבלה בכלל - נוצר כשורה חדשה
insert into public.destinations (name, country, image_url, is_hot_destination)
select t.name, t.country, '/images/destinations/' || t.filename, true
from (values
  ('בוקרשט', 'רומניה', 'bucharest.png'),
  ('בודפשט', 'הונגריה', 'budapest.png'),
  ('כרתים', 'יוון', 'crete.png'),
  ('ברצלונה', 'ספרד', 'imgaebarcelona.png'),
  ('לונדון', 'בריטניה', 'london.png'),
  ('מיקונוס', 'יוון', 'mykonos.png'),
  ('ניו יורק', 'ארצות הברית', 'newyork.png'),
  ('פאפוס', 'קפריסין', 'papos.png'),
  ('פריז', 'צרפת', 'paris.png'),
  ('פוקט', 'תאילנד', 'pocket.png'),
  ('פראג', 'צ''כיה', 'prague.png'),
  ('רומא', 'איטליה', 'rome.png'),
  ('טוקיו', 'יפן', 'tokio.png'),
  ('וינה', 'אוסטריה', 'vienna.png')
) as t(name, country, filename)
where not exists (select 1 from public.destinations d where d.name = t.name);
