-- "קרוב אליי" - קאש של reverse-geocoding על הקואורדינטות של כל מקום,
-- כדי לאמת שה-city שרשום למקום תואם בפועל למיקום הגיאוגרפי שלו (ולא
-- טעות הזנת נתונים כמו "מטולה" עם קואורדינטות שנמצאות בפועל ברמת גן).
-- מחושב פעם אחת (lazy, בזמן חיפוש "קרוב אליי") ונשמר כאן כדי לא לקרוא
-- ל-Google Geocoding API בכל חיפוש מחדש לאותו מקום.

alter table places
  add column if not exists geocoded_city text,
  add column if not exists geocoded_at timestamptz;
