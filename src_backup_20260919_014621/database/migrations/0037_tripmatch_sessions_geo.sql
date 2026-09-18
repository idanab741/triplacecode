-- "קרוב אליי" ב-TripMatch: מאפשר לחפש מועמדים ברדיוס אמיתי (ק"מ) מסביב
-- לקואורדינטות המשתמש, במקום התאמת שם עיר (ILIKE) - כי מקום קרוב יכול
-- להיות רשום תחת עיר שכנה (למשל "רמת גן" ליד "תל אביב") שלא תואמת
-- טקסטואלית לשם שהתקבל מ-reverse geocoding או מהכתובת השמורה.
-- כשהעמודות null (המצב הרגיל) - fetchTripMatchCandidates ממשיך לעבוד
-- בדיוק כמו קודם, לפי עיר/מדינה.

alter table tripmatch_sessions
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists radius_km double precision;
