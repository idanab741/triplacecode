-- ========================================================================
-- Migration 0022: תוספת 20 ערים גדולות נוספות בישראל ל-destinations
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- תוספת בלבד - לא מוחק כלום, אידמפוטנטי (WHERE NOT EXISTS, אין unique על name).
-- ========================================================================

insert into public.destinations (name, country, latitude, longitude)
select * from (values
  ('רחובות', 'ישראל', 31.8928::double precision, 34.8113::double precision),
  ('מודיעין-מכבים-רעות', 'ישראל', 31.8928::double precision, 35.0095::double precision),
  ('בית שמש', 'ישראל', 31.75::double precision, 34.9885::double precision),
  ('הוד השרון', 'ישראל', 32.15::double precision, 34.8886::double precision),
  ('גבעתיים', 'ישראל', 32.0728::double precision, 34.8114::double precision),
  ('קריית אתא', 'ישראל', 32.8::double precision, 35.1::double precision),
  ('קריית גת', 'ישראל', 31.61::double precision, 34.7642::double precision),
  ('קריית מוצקין', 'ישראל', 32.8386::double precision, 35.0781::double precision),
  ('קריית ביאליק', 'ישראל', 32.8281::double precision, 35.0819::double precision),
  ('נהריה', 'ישראל', 33.0072::double precision, 35.0925::double precision),
  ('כרמיאל', 'ישראל', 32.9186::double precision, 35.2953::double precision),
  ('עפולה', 'ישראל', 32.6078::double precision, 35.2897::double precision),
  ('חדרה', 'ישראל', 32.434::double precision, 34.9196::double precision),
  ('יבנה', 'ישראל', 31.8783::double precision, 34.7378::double precision),
  ('נס ציונה', 'ישראל', 31.9297::double precision, 34.7975::double precision),
  ('אור יהודה', 'ישראל', 32.0333::double precision, 34.85::double precision),
  ('דימונה', 'ישראל', 31.0692::double precision, 35.0331::double precision),
  ('ערד', 'ישראל', 31.2589::double precision, 35.2128::double precision),
  ('קריית שמונה', 'ישראל', 33.2075::double precision, 35.5697::double precision),
  ('בנימינה', 'ישראל', 32.5175::double precision, 34.95::double precision)
) as v(name, country, latitude, longitude)
where not exists (select 1 from public.destinations d where d.name = v.name);