-- קאש קטן לקואורדינטות של ערים שנשלפו באמצעות Google Geocoding (forward
-- geocoding) בזמן אמת ב"קרוב אליי" - למקומות שלא נמצאים בטבלת
-- ה-destinations המתוירת (221 יעדים בלבד). ברמת עיר (לא ברמת מקום בודד)
-- כדי שכל המקומות שרשומים תחת אותה עיר ישתפו את אותה קריאת API - במקום
-- לקרוא לגוגל בנפרד לכל מקום.

create table if not exists city_geocode_cache (
  city_name text primary key,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

alter table city_geocode_cache enable row level security;

create policy "Authenticated users can read city geocode cache"
  on city_geocode_cache for select
  to authenticated
  using (true);

-- טבלת קאש גלובלית (לא per-user) - כל משתמש מחובר יכול להוסיף אליה
-- ערך חדש (עיר שעוד לא הייתה בקאש). זה בטוח כי היא רק שומרת קואורדינטות
-- של שם עיר (לא מידע פרטי), ומשמשת רק לצמצום קריאות ל-Google Geocoding.
create policy "Authenticated users can add to city geocode cache"
  on city_geocode_cache for insert
  to authenticated
  with check (true);
