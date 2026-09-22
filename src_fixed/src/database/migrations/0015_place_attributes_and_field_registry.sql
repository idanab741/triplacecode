-- ========================================================================
-- Migration 0015: הרחבת Universal Place Card + מרשם שדות דינמי (Field Registry)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- עקרון מנחה - "לא לפגוע באפליקציה הקיימת":
-- כל שינוי כאן הוא תוספת בלבד (ADD COLUMN / CREATE TABLE). אף עמודה קיימת
-- לא משתנה, לא נמחקת, ולא משנה משמעות. כל העמודות החדשות הן nullable או עם
-- default, כך ש-`select *` הקיים בקוד (candidatePoolService, tripMatchService,
-- fetch.ts וכו') ימשיך לעבוד בלי שינוי - הן פשוט יחזירו NULL/ריק לשורות ישנות
-- עד שימולאו. category/subcategory/tags הקיימים נשארים בדיוק כפי שהיו.
-- ========================================================================

-- ------------------------------------------------------------------------
-- חלק א' - שדות Universal Place Card שהיו חסרים (עמ' 4-8 במסמך האפיון)
-- ------------------------------------------------------------------------

alter table public.places
  -- זיהוי: מפתח יציב לסוג היעד (nature_trail, hotel, bar...) - נפרד בכוונה
  -- מ-category/subcategory הקיימים (שהם טקסט חופשי/תצוגה) כדי לא לגעת בהם.
  -- זה המפתח שמקשר ל-place_type_field_defs למטה.
  add column if not exists place_type_key text,

  -- תיאור
  add column if not exists suitable_for_description text,

  -- מיקום - "אזור/שכונה" היה חסר (יש רק city/country)
  add column if not exists neighborhood text,

  -- שעות פעילות - "שעות מומלצות" היה חסר (estimated_visit_minutes כבר קיים)
  add column if not exists recommended_hours text,

  -- מחיר - היה רק price_level גנרי, המסמך מבקש 3 שדות נפרדים
  add column if not exists entrance_price numeric(10, 2),
  add column if not exists average_price numeric(10, 2),
  add column if not exists requires_reservation boolean,

  -- דירוג - "רמת פופולריות" כשדה נפרד מ-rating/rating_count
  add column if not exists popularity_level text
    check (popularity_level in ('low', 'medium', 'high', 'very_high') or popularity_level is null),

  -- התאמה לקהל (בחירה מרובה) + גילאי ילדים
  add column if not exists audience_fit text[] not null default '{}',
  add column if not exists suitable_child_age_bands text[] not null default '{}',

  -- Place DNA - תגיות מסווגות (בכוונה נפרד מ-tags[] הגנרי הקיים, כדי
  -- לא לשבור קוד קיים שקורא tags[]; dna_tags הוא הטקסונומיה המסודרת החדשה)
  add column if not exists dna_tags text[] not null default '{}',

  -- עונתיות
  add column if not exists seasonality text[] not null default '{}',

  -- התאמה למזג אוויר
  add column if not exists weather_fit text[] not null default '{}',

  -- נגישות ברמת המקום (שונה מ-travel_dna.accessibility שהוא ברמת המשתמש)
  add column if not exists accessibility_features text[] not null default '{}',

  -- בעלי חיים ברמת המקום
  add column if not exists pet_friendliness_features text[] not null default '{}',

  -- שדות ייעודיים לפי סוג יעד (מסלול טבע: אורך/קושי/מפלים..., מלון: כוכבים/צ'ק-אין...)
  -- ה-JSON הזה מכיל *רק* מפתחות שמוגדרים מראש ב-place_type_field_defs (נאכף
  -- באפליקציה/API, לא ב-DB, כדי לא להסתבך ב-CHECK constraints דינמיים).
  add column if not exists type_attributes jsonb not null default '{}';

comment on column public.places.place_type_key is
  'מפתח יציב לסוג היעד (nature_trail / hotel / bar / restaurants_cafes...) - קושר ל-place_type_field_defs.place_type. שונה מ-category/subcategory הקיימים שהם טקסט תצוגה חופשי.';
comment on column public.places.type_attributes is
  'שדות ייעודיים לסוג היעד (jsonb) - המפתחות המותרים מוגדרים ב-place_type_field_defs, לא ב-DB עצמו. נאכף ברמת ה-API.';

-- ------------------------------------------------------------------------
-- חלק ב' - מרשם השדות הדינמי (Field Registry)
-- זו הטבלה שהופכת "סוג יעד חדש" / "שדה חדש" לפעולת אדמין, לא דיפלוי קוד.
-- ------------------------------------------------------------------------

create table public.place_type_field_defs (
  id uuid primary key default gen_random_uuid(),

  -- מפתח סוג היעד - למשל 'nature_trail', 'hotel', 'bar', 'restaurants_cafes'.
  -- לא FK פורמלי לשום טבלת "enum" - בכוונה: מנהל אדמין יוצר סוג יעד חדש
  -- פשוט ע"י יצירת שורת field_def ראשונה עם place_type חדש, בלי מיגרציה.
  place_type text not null,

  field_key text not null,
  label_he text not null,

  field_type text not null
    check (field_type in ('number', 'text', 'boolean', 'single_select', 'multi_select')),

  -- לטיפוסי select בלבד: [{ "value": "easy", "label_he": "קל" }, ...]
  options jsonb,

  -- לתצוגה מסודרת בטופס העריכה באדמין
  sort_order integer not null default 0,

  -- מאפשר "לכבות" שדה זמנית בלי למחוק אותו (ולאבד נתונים היסטוריים ב-JSON)
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (place_type, field_key)
);

alter table public.place_type_field_defs enable row level security;

-- אותו דפוס בדיוק כמו places: קריאה למחוברים, כתיבה רק מהשרת (service_role)
create policy "Authenticated users can view place type field defs"
  on public.place_type_field_defs for select
  to authenticated
  using (true);

create trigger set_place_type_field_defs_updated_at
  before update on public.place_type_field_defs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------
-- חלק ג' - מילוי ראשוני: השדות הייעודיים שכבר מופיעים במסמך האפיון
-- (עמ' 9-12: מסעדות ובתי קפה, מסלולי טבע, חופים/מים, אטרקציות, מוזיאונים,
-- מלונות, ברים) - כדי שה-POC על "טיול יומי" יהיה שלם מהיום הראשון.
-- ------------------------------------------------------------------------

insert into public.place_type_field_defs (place_type, field_key, label_he, field_type, options, sort_order) values
  -- מסעדות ובתי קפה
  ('restaurants_cafes', 'cuisine_type', 'סוג המטבח', 'multi_select',
    '[{"value":"israeli","label_he":"ישראלי"},{"value":"italian","label_he":"איטלקי"},{"value":"asian","label_he":"אסייתי"},{"value":"bbq","label_he":"בשרים ועל האש"},{"value":"burger_diner","label_he":"המבורגר ודיינר אמריקאי"},{"value":"mexican","label_he":"מקסיקני"},{"value":"greek","label_he":"יווני"},{"value":"french_bistro","label_he":"ביסטרו צרפתי"},{"value":"indian","label_he":"הודי"},{"value":"mediterranean","label_he":"ים־תיכוני"},{"value":"seafood","label_he":"דגים ופירות ים"},{"value":"pizza","label_he":"פיצה"},{"value":"breakfast_brunch","label_he":"ארוחת בוקר ובראנץ׳"},{"value":"cafe","label_he":"בית קפה"},{"value":"desserts","label_he":"מאנצ׳ים ומתוקים"}]', 1),
  ('restaurants_cafes', 'dietary_options', 'מגבלות תזונה', 'multi_select',
    '[{"value":"kosher","label_he":"כשר"},{"value":"vegetarian","label_he":"צמחוני"},{"value":"vegan","label_he":"טבעוני"},{"value":"gluten_free","label_he":"ללא גלוטן"},{"value":"lactose_free","label_he":"ללא לקטוז"}]', 2),
  ('restaurants_cafes', 'reservation_recommended', 'מומלץ להזמין מקום', 'boolean', null, 3),
  ('restaurants_cafes', 'suitable_for_date', 'מתאים לדייט', 'boolean', null, 4),
  ('restaurants_cafes', 'suitable_for_groups', 'מתאים לקבוצות', 'boolean', null, 5),

  -- מסלולי טבע
  ('nature_trail', 'trail_shape', 'סוג המסלול', 'single_select',
    '[{"value":"loop","label_he":"מעגלי"},{"value":"linear","label_he":"קווי"},{"value":"out_and_back","label_he":"הלוך-חזור"}]', 1),
  ('nature_trail', 'trail_length_km', 'אורך המסלול (ק״מ)', 'number', null, 2),
  ('nature_trail', 'walking_time_minutes', 'זמן הליכה (דקות)', 'number', null, 3),
  ('nature_trail', 'difficulty_level', 'רמת קושי', 'single_select',
    '[{"value":"easy","label_he":"קל"},{"value":"moderate","label_he":"בינוני"},{"value":"challenging","label_he":"מאתגר"}]', 4),
  ('nature_trail', 'elevation_gain_m', 'הפרשי גובה (מטר)', 'number', null, 5),
  ('nature_trail', 'trail_marking', 'סימון שבילים', 'text', null, 6),
  ('nature_trail', 'terrain_type', 'סוג הקרקע', 'text', null, 7),
  ('nature_trail', 'stroller_friendly', 'מתאים לעגלות', 'boolean', null, 8),
  ('nature_trail', 'kid_friendly', 'מתאים לילדים', 'boolean', null, 9),
  ('nature_trail', 'dog_friendly', 'מתאים לכלבים', 'boolean', null, 10),
  ('nature_trail', 'bike_friendly', 'מתאים לאופניים', 'boolean', null, 11),
  ('nature_trail', 'has_swimming_water', 'מים לשחייה', 'boolean', null, 12),
  ('nature_trail', 'has_viewpoints', 'תצפיות', 'boolean', null, 13),
  ('nature_trail', 'seasonal_bloom', 'פריחה עונתית', 'boolean', null, 14),
  ('nature_trail', 'has_waterfalls', 'מפלים', 'boolean', null, 15),
  ('nature_trail', 'has_caves', 'מערות', 'boolean', null, 16),
  ('nature_trail', 'shaded_path', 'צל לאורך הדרך', 'boolean', null, 17),
  ('nature_trail', 'water_points', 'נקודות מים', 'boolean', null, 18),
  ('nature_trail', 'has_restrooms', 'שירותים', 'boolean', null, 19),
  ('nature_trail', 'has_parking', 'חניה', 'boolean', null, 20),
  ('nature_trail', 'cellular_reception', 'קליטה סלולרית', 'boolean', null, 21),
  ('nature_trail', 'required_equipment', 'ציוד חובה', 'text', null, 22),
  ('nature_trail', 'safety_warnings', 'אזהרות בטיחות', 'text', null, 23),

  -- חופים, מעיינות ואטרקציות מים
  ('beach_water', 'water_place_type', 'סוג המקום', 'text', null, 1),
  ('beach_water', 'water_kind', 'מים מתוקים / ים', 'single_select',
    '[{"value":"freshwater","label_he":"מים מתוקים"},{"value":"sea","label_he":"ים"}]', 2),
  ('beach_water', 'is_free_entry', 'כניסה חינם / בתשלום', 'boolean', null, 3),
  ('beach_water', 'kid_friendly', 'מתאים לילדים', 'boolean', null, 4),
  ('beach_water', 'dog_friendly', 'מתאים לכלבים', 'boolean', null, 5),
  ('beach_water', 'has_showers', 'מקלחות', 'boolean', null, 6),
  ('beach_water', 'has_restrooms', 'שירותים', 'boolean', null, 7),
  ('beach_water', 'has_shade', 'הצללה', 'boolean', null, 8),
  ('beach_water', 'has_chairs_umbrellas', 'כסאות ושמשיות', 'boolean', null, 9),
  ('beach_water', 'picnic_allowed', 'פיקניק', 'boolean', null, 10),
  ('beach_water', 'bbq_allowed', 'מנגל', 'boolean', null, 11),

  -- אטרקציות
  ('attraction', 'attraction_type', 'סוג האטרקציה', 'text', null, 1),
  ('attraction', 'min_age', 'גיל מינימלי', 'number', null, 2),
  ('attraction', 'recommended_age', 'גיל מומלץ', 'number', null, 3),
  ('attraction', 'activity_duration_minutes', 'משך הפעילות (דקות)', 'number', null, 4),
  ('attraction', 'suitable_for_families', 'מתאים למשפחות', 'boolean', null, 5),
  ('attraction', 'suitable_for_couples', 'מתאים לזוגות', 'boolean', null, 6),
  ('attraction', 'suitable_for_groups', 'מתאים לקבוצות', 'boolean', null, 7),
  ('attraction', 'adrenaline_level', 'רמת אדרנלין', 'single_select',
    '[{"value":"low","label_he":"נמוכה"},{"value":"medium","label_he":"בינונית"},{"value":"high","label_he":"גבוהה"}]', 8),
  ('attraction', 'reservation_required', 'יש צורך בהזמנה', 'boolean', null, 9),
  ('attraction', 'special_equipment', 'ציוד מיוחד', 'text', null, 10),

  -- מוזיאונים ואתרי תרבות
  ('museum', 'theme', 'נושא', 'text', null, 1),
  ('museum', 'guided_tours', 'סיורים מודרכים', 'boolean', null, 2),
  ('museum', 'recommended_visit_time', 'זמן ביקור מומלץ', 'text', null, 3),
  ('museum', 'kid_friendly', 'מתאים לילדים', 'boolean', null, 4),
  ('museum', 'suitable_for_families', 'מתאים למשפחות', 'boolean', null, 5),

  -- מלונות וצימרים
  ('hotel', 'lodging_type', 'סוג לינה', 'text', null, 1),
  ('hotel', 'star_rating', 'מספר כוכבים', 'number', null, 2),
  ('hotel', 'check_in_time', 'צ׳ק אין', 'text', null, 3),
  ('hotel', 'check_out_time', 'צ׳ק אאוט', 'text', null, 4),
  ('hotel', 'room_types', 'סוגי חדרים', 'text', null, 5),
  ('hotel', 'breakfast_included', 'ארוחת בוקר', 'boolean', null, 6),
  ('hotel', 'has_pool', 'בריכה', 'boolean', null, 7),
  ('hotel', 'has_spa', 'ספא', 'boolean', null, 8),
  ('hotel', 'has_gym', 'חדר כושר', 'boolean', null, 9),
  ('hotel', 'has_parking', 'חניה', 'boolean', null, 10),
  ('hotel', 'suitable_for_couples', 'מתאים לזוגות', 'boolean', null, 11),
  ('hotel', 'suitable_for_families', 'מתאים למשפחות', 'boolean', null, 12),
  ('hotel', 'kid_friendly', 'מתאים לילדים', 'boolean', null, 13),
  ('hotel', 'dog_friendly', 'מתאים לכלבים', 'boolean', null, 14),
  ('hotel', 'free_cancellation', 'ביטול חינם', 'boolean', null, 15),

  -- ברים, פאבים ומועדונים
  ('bar', 'venue_type', 'סוג המקום', 'text', null, 1),
  ('bar', 'minimum_age', 'גיל כניסה', 'number', null, 2),
  ('bar', 'has_happy_hour', 'Happy Hour', 'boolean', null, 3),
  ('bar', 'has_live_music', 'הופעות חיות', 'boolean', null, 4),
  ('bar', 'has_cocktails', 'קוקטיילים', 'boolean', null, 5),
  ('bar', 'serves_food', 'אוכל', 'boolean', null, 6),
  ('bar', 'outdoor_seating', 'ישיבה בחוץ', 'boolean', null, 7)
on conflict (place_type, field_key) do nothing;
