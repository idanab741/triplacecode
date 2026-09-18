-- ========================================================================
-- Migration 0016: taxonomy_terms - מילון מרכזי לכל הערכים החוצים סוגי טיול
-- (סוגי טיול, תחומי עניין, קהלי יעד, עונות, מזג אוויר, Place DNA וכו')
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- עקרון מנחה זהה ל-0015: תוספת בלבד. הערכים כאן הם בדיוק אותם ID-ים שכבר
-- בשימוש בקוד הקיים (locales/he/preferences.ts, services/places/tripTaxonomy.ts)
-- - הועתקו אוטומטית מהקוד עצמו, לא הומצאו מחדש - כדי שחיבור עתידי של
-- הצרכנים הקיימים לטבלה הזו לא ישנה שום ID שכבר שמור ב-DB של משתמשים.
-- ========================================================================

create table public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  taxonomy_group text not null,
  parent_term_id uuid references public.taxonomy_terms (id) on delete cascade,
  value text not null,
  label_he text not null,
  emoji text,
  image_src text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxonomy_group, value)
);

alter table public.taxonomy_terms enable row level security;

create policy "Authenticated users can view taxonomy terms"
  on public.taxonomy_terms for select
  to authenticated
  using (true);

create trigger set_taxonomy_terms_updated_at
  before update on public.taxonomy_terms
  for each row execute function public.set_updated_at();

create index taxonomy_terms_group_idx on public.taxonomy_terms (taxonomy_group);
create index taxonomy_terms_parent_idx on public.taxonomy_terms (parent_term_id);

-- סוגי הטיול (7, תואם services/tripBuilder/types.ts TripType)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('trip_type', 'day_trip', 'טיול יומי', null, 0),
  ('trip_type', 'nature_trip', 'טיול בטבע', null, 1),
  ('trip_type', 'weekend', 'סופ"ש', null, 2),
  ('trip_type', 'romantic_date', 'דייט רומנטי', null, 3),
  ('trip_type', 'restaurants_cafes', 'מסעדות ובתי קפה', null, 4),
  ('trip_type', 'nightlife', 'חיי לילה', null, 5),
  ('trip_type', 'abroad_vacation', 'חופשה בחו"ל', null, 6)
on conflict (taxonomy_group, value) do nothing;

-- עונתיות (SEASON_OPTIONS)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('season', 'spring', 'אביב', null, 0),
  ('season', 'summer', 'קיץ', null, 1),
  ('season', 'autumn', 'סתיו', null, 2),
  ('season', 'winter', 'חורף', null, 3),
  ('season', 'all_year', 'כל השנה', null, 4)
on conflict (taxonomy_group, value) do nothing;

-- טווחי גיל ילדים (CHILD_AGE_OPTIONS)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('child_age_band', '0-3', '0-3', null, 0),
  ('child_age_band', '3-7', '3-7', null, 1),
  ('child_age_band', '7-12', '7-12', null, 2),
  ('child_age_band', '12-18', '12-18', null, 3)
on conflict (taxonomy_group, value) do nothing;

-- רמת תקציב (BUDGET_TIER_OPTIONS)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('budget_tier', '$', '$', null, 0),
  ('budget_tier', '$$', '$$', null, 1),
  ('budget_tier', '$$$', '$$$', null, 2),
  ('budget_tier', '$$$$', '$$$$', null, 3)
on conflict (taxonomy_group, value) do nothing;

-- תגיות מטבח למסעדות (CUISINE_TAGS)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('cuisine_tag', 'italian', 'איטלקי', '🇮🇹', 0),
  ('cuisine_tag', 'asian', 'אסייתי', '🥢', 1),
  ('cuisine_tag', 'meat_grill', 'בשרים ועל האש', '🥩', 2),
  ('cuisine_tag', 'burger', 'המבורגר', '🍔', 3),
  ('cuisine_tag', 'mexican', 'מקסיקני', '🇲🇽', 4),
  ('cuisine_tag', 'greek', 'יווני', '🇬🇷', 5),
  ('cuisine_tag', 'french_bistro', 'ביסטרו צרפתי', '🇫🇷', 6),
  ('cuisine_tag', 'indian', 'הודי', '🇮🇳', 7),
  ('cuisine_tag', 'mediterranean', 'ים־תיכוני', '🌿', 8),
  ('cuisine_tag', 'seafood', 'דגים ופירות ים', '🐟', 9),
  ('cuisine_tag', 'pizza', 'פיצה', '🍕', 10),
  ('cuisine_tag', 'israeli_middle_eastern', 'ישראלי ומזרח תיכוני', '🥙', 11),
  ('cuisine_tag', 'breakfast_brunch', 'ארוחת בוקר ובראנץ''', '🥐', 12),
  ('cuisine_tag', 'cafe', 'בית קפה', '☕', 13),
  ('cuisine_tag', 'desserts', 'קינוחים ומתוקים', '🍰', 14),
  ('cuisine_tag', 'salads_healthy', 'סלטים ובריאות', '🥗', 15)
on conflict (taxonomy_group, value) do nothing;

-- סגנון קולינרי בפרופיל המשתמש (CULINARY_STYLES)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('culinary_style', 'israeli', 'ישראלי', null, 0),
  ('culinary_style', 'italian', 'איטלקי', null, 1),
  ('culinary_style', 'asian', 'אסייתי', null, 2),
  ('culinary_style', 'meat_bbq', 'בשרים ועל האש', null, 3),
  ('culinary_style', 'burger_diner', 'המבורגר ודיינר אמריקאי', null, 4),
  ('culinary_style', 'mexican', 'מקסיקני', null, 5),
  ('culinary_style', 'greek', 'יווני', null, 6),
  ('culinary_style', 'french_bistro', 'ביסטרו צרפתי', null, 7),
  ('culinary_style', 'indian', 'הודי', null, 8),
  ('culinary_style', 'mediterranean', 'ים־תיכוני', null, 9),
  ('culinary_style', 'seafood', 'דגים ופירות ים', null, 10),
  ('culinary_style', 'pizza', 'פיצה', null, 11),
  ('culinary_style', 'breakfast_brunch', 'ארוחת בוקר ובראנץ''', null, 12),
  ('culinary_style', 'cafe', 'בית קפה', null, 13),
  ('culinary_style', 'fine_dining', 'מסעדות שף', null, 14),
  ('culinary_style', 'snacks_sweets', 'מאנצ''ים ומתוקים', null, 15)
on conflict (taxonomy_group, value) do nothing;

-- מגבלות תזונה (DIETARY_RESTRICTIONS)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('dietary_restriction', 'vegetarian', 'צמחוני', null, 0),
  ('dietary_restriction', 'vegan', 'טבעוני', null, 1),
  ('dietary_restriction', 'kosher', 'כשר', null, 2)
on conflict (taxonomy_group, value) do nothing;

-- התניידות (TRANSPORTATION)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('transportation', 'private_car', 'רכב פרטי', null, 0),
  ('transportation', 'public_transport', 'תחבורה ציבורית', null, 1),
  ('transportation', 'bicycle', 'אופניים', null, 2),
  ('transportation', 'motorcycle', 'אופנוע', null, 3),
  ('transportation', 'walking', 'הליכה ברגל', null, 4)
on conflict (taxonomy_group, value) do nothing;

-- סוגי לינה מועדפים (ACCOMMODATION_TYPES)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('accommodation_type', 'hotel', 'מלון', null, 0),
  ('accommodation_type', 'resort', 'ריזורט ואתרי נופש', null, 1),
  ('accommodation_type', 'apartment', 'דירה', null, 2),
  ('accommodation_type', 'cabin', 'צימר', null, 3),
  ('accommodation_type', 'hostel', 'הוסטל', null, 4),
  ('accommodation_type', 'camping', 'קמפינג', null, 5),
  ('accommodation_type', 'glamping', 'גלמפינג', null, 6),
  ('accommodation_type', 'villa', 'וילה', null, 7)
on conflict (taxonomy_group, value) do nothing;

-- העדפות חופשות בחו"ל (VACATION_PREFERENCES)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('vacation_preference', 'beach_relax', 'בטן גב וחופים', null, 0),
  ('vacation_preference', 'casino_gambling', 'קזינו והימורים', null, 1),
  ('vacation_preference', 'cruise', 'קרוזים ושייט', null, 2),
  ('vacation_preference', 'family', 'חופשה משפחתית', null, 3),
  ('vacation_preference', 'seasonal_holidays', 'חופשות עונתיות', null, 4),
  ('vacation_preference', 'honeymoon_romantic', 'חופשה רומנטית וירח דבש', null, 5),
  ('vacation_preference', 'live_shows_festivals', 'הופעות חיות ופסטיבלים', null, 6),
  ('vacation_preference', 'digital_nomad', 'נוודות דיגיטלית', null, 7),
  ('vacation_preference', 'luxury_indulgence', 'יוקרה ופינוקים', null, 8),
  ('vacation_preference', 'spa_wellness_retreats', 'ספא, וולנס וריטריטים', null, 9),
  ('vacation_preference', 'ski_winter_sports', 'סקי וספורט חורף', null, 10),
  ('vacation_preference', 'sports_events', 'אירועי ספורט', null, 11),
  ('vacation_preference', 'backpacking_trekking', 'טיולי תרמילאים', null, 12),
  ('vacation_preference', 'tropical_vacation', 'חופשות טרופיות', null, 13),
  ('vacation_preference', 'urban_city_trip', 'חופשה עירונית', null, 14),
  ('vacation_preference', 'parties_nightlife', 'מסיבות וחיי לילה', null, 15)
on conflict (taxonomy_group, value) do nothing;

-- התאמה לקהל - places.audience_fit (Universal Place Card, migration 0015)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('audience_fit', 'couples', 'זוגות', null, 0),
  ('audience_fit', 'families', 'משפחות', null, 1),
  ('audience_fit', 'kids', 'ילדים', null, 2),
  ('audience_fit', 'friends', 'חברים', null, 3),
  ('audience_fit', 'solo', 'מטייל יחיד', null, 4),
  ('audience_fit', 'groups', 'קבוצות', null, 5),
  ('audience_fit', 'pets', 'בעלי חיים', null, 6)
on conflict (taxonomy_group, value) do nothing;

-- התאמה למזג אוויר - places.weather_fit (migration 0015)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('weather_fit', 'hot_days', 'מתאים לימים חמים', null, 0),
  ('weather_fit', 'cold_days', 'מתאים לימים קרים', null, 1),
  ('weather_fit', 'rain', 'מתאים לגשם', null, 2),
  ('weather_fit', 'shaded', 'מוצל', null, 3),
  ('weather_fit', 'air_conditioned', 'ממוזג', null, 4)
on conflict (taxonomy_group, value) do nothing;

-- נגישות ברמת המקום - places.accessibility_features (migration 0015)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('accessibility_feature', 'wheelchair', 'נגיש לכיסא גלגלים', null, 0),
  ('accessibility_feature', 'stroller_friendly', 'מתאים לעגלות', null, 1),
  ('accessibility_feature', 'accessible_restrooms', 'שירותים נגישים', null, 2),
  ('accessibility_feature', 'disabled_parking', 'חניית נכים', null, 3),
  ('accessibility_feature', 'no_stairs', 'ללא מדרגות', null, 4)
on conflict (taxonomy_group, value) do nothing;

-- בעלי חיים ברמת המקום - places.pet_friendliness_features (migration 0015)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('pet_friendliness_feature', 'dogs_allowed', 'כניסה לכלבים', null, 0),
  ('pet_friendliness_feature', 'off_leash_area', 'אזור שחרור', null, 1),
  ('pet_friendliness_feature', 'pet_friendly', 'ידידותי לבעלי חיים', null, 2)
on conflict (taxonomy_group, value) do nothing;

-- Place DNA - places.dna_tags (Universal Place Card, migration 0015)
insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('place_dna_tag', 'nature', 'טבע', null, 0),
  ('place_dna_tag', 'view', 'נוף', null, 1),
  ('place_dna_tag', 'sea', 'ים', null, 2),
  ('place_dna_tag', 'beach', 'חוף', null, 3),
  ('place_dna_tag', 'pool', 'בריכה', null, 4),
  ('place_dna_tag', 'spring', 'מעיין', null, 5),
  ('place_dna_tag', 'stream', 'נחל', null, 6),
  ('place_dna_tag', 'forest', 'יער', null, 7),
  ('place_dna_tag', 'mountains', 'הרים', null, 8),
  ('place_dna_tag', 'desert', 'מדבר', null, 9),
  ('place_dna_tag', 'urban', 'עירוני', null, 10),
  ('place_dna_tag', 'culture', 'תרבות', null, 11),
  ('place_dna_tag', 'art', 'אמנות', null, 12),
  ('place_dna_tag', 'history', 'היסטוריה', null, 13),
  ('place_dna_tag', 'culinary', 'קולינריה', null, 14),
  ('place_dna_tag', 'coffee', 'קפה', null, 15),
  ('place_dna_tag', 'winery', 'יקב', null, 16),
  ('place_dna_tag', 'shopping', 'שופינג', null, 17),
  ('place_dna_tag', 'music', 'מוזיקה', null, 18),
  ('place_dna_tag', 'live_shows', 'הופעות', null, 19),
  ('place_dna_tag', 'nightlife', 'חיי לילה', null, 20),
  ('place_dna_tag', 'sports', 'ספורט', null, 21),
  ('place_dna_tag', 'extreme', 'אקסטרים', null, 22),
  ('place_dna_tag', 'water', 'מים', null, 23),
  ('place_dna_tag', 'spa', 'ספא', null, 24),
  ('place_dna_tag', 'calm', 'רוגע', null, 25),
  ('place_dna_tag', 'luxurious', 'יוקרתי', null, 26),
  ('place_dna_tag', 'romantic', 'רומנטי', null, 27),
  ('place_dna_tag', 'family_friendly', 'משפחתי', null, 28),
  ('place_dna_tag', 'instagrammable', 'אינסטגרמי', null, 29),
  ('place_dna_tag', 'authentic', 'אותנטי', null, 30),
  ('place_dna_tag', 'local', 'מקומי', null, 31),
  ('place_dna_tag', 'popular', 'פופולרי', null, 32),
  ('place_dna_tag', 'hidden_gem', 'פנינה נסתרת', null, 33)
on conflict (taxonomy_group, value) do nothing;

-- תחומי עניין ראשיים - איחוד services/places/tripTaxonomy.ts (TRIP_TYPE_GROUPS)
-- ו-locales/he/preferences.ts (INTERESTS) - שתי הרשימות השתמשו כבר באותם
-- ID-ים (coffee_carts_cafes, nature_trails...) בשני קבצים נפרדים; זו בדיוק
-- הכפילות שמאוחדת כאן למקור אחד.
with inserted_groups as (
  insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
    ('interest_category', 'coffee_carts_cafes', 'עגלות קפה ובתי קפה', '☕', 0),
    ('interest_category', 'nature_trails', 'מסלולי טבע ונופים', '🌿', 1),
    ('interest_category', 'beaches_pools', 'חופי ים ובריכות', '🏖️', 2),
    ('interest_category', 'viewpoints', 'תצפיות, זריחות ושקיעות', '🌅', 3),
    ('interest_category', 'parks_gardens', 'פארקים וגנים', '🌳', 4),
    ('interest_category', 'water_amusement_parks', 'פארקי מים, שעשועים ומתקנים', '🎡', 5),
    ('interest_category', 'attractions_activities', 'אטרקציות ופעילויות', '🎯', 6),
    ('interest_category', 'sports_extreme', 'ספורט ואקסטרים', '🚴', 7),
    ('interest_category', 'wineries_dining', 'יקבים, מבשלות ומסעדות', '🍷', 8),
    ('interest_category', 'culture_history', 'תרבות, מוזיאונים והיסטוריה', '🏛️', 9),
    ('interest_category', 'shopping', 'שופינג, קניות ושווקים', '🛍️', 10),
    ('interest_category', 'events_festivals', 'אירועים ופסטיבלים', '🎪', 11),
    ('interest_category', 'spa_relaxation', 'ספא ורוגע', '🧖', 12),
    ('interest_category', 'restaurants_culinary', 'מסעדות וקולינריה', null, 13),
    ('interest_category', 'wineries_breweries', 'יקבים ומבשלות', null, 14),
    ('interest_category', 'nightlife_entertainment', 'חיי לילה ובילויים', null, 15),
    ('interest_category', 'boating_water_attractions', 'שיט ואטרקציות מים', null, 16),
    ('interest_category', 'heritage_holy_sites', 'אתרי מורשת ומקומות קדושים', null, 17),
    ('interest_category', 'kids_family_activities', 'פעילויות לילדים ומשפחות', null, 18),
    ('interest_category', 'art_galleries', 'אמנות וגלריות', null, 19),
    ('interest_category', 'photo_spots', 'נקודות צילום ונופי אינסטגרם', null, 20)
  on conflict (taxonomy_group, value) do nothing
  returning id, value
)
insert into public.taxonomy_terms (taxonomy_group, parent_term_id, value, label_he, sort_order)
select 'interest_subcategory', inserted_groups.id, sub.value, sub.label_he, sub.sort_order
from inserted_groups
join (values
  ('coffee_carts_cafes', 'cafe', 'בתי קפה', 0),
  ('coffee_carts_cafes', 'coffee_cart', 'עגלות קפה', 1),
  ('coffee_carts_cafes', 'specialty_coffee', 'קפה מיוחד/בוטיק', 2),
  ('coffee_carts_cafes', 'cafe_with_view', 'בית קפה עם נוף', 3),
  ('coffee_carts_cafes', 'dog_friendly_cafe', 'בית קפה ידידותי לכלבים', 4),
  ('coffee_carts_cafes', 'bakery_cafe', 'מאפייה עם ישיבה', 5),
  ('nature_trails', 'nature_reserve', 'שמורות טבע', 0),
  ('nature_trails', 'hiking_trail', 'מסלולי הליכה', 1),
  ('nature_trails', 'trip_route', 'מסלולי טיול', 2),
  ('nature_trails', 'forest', 'יערות', 3),
  ('nature_trails', 'grove', 'חורשות', 4),
  ('nature_trails', 'mountain', 'הרים', 5),
  ('nature_trails', 'canyon', 'קניונים', 6),
  ('nature_trails', 'valley', 'עמקים', 7),
  ('nature_trails', 'hill', 'גבעות', 8),
  ('nature_trails', 'seasonal_bloom', 'פריחות עונתיות', 9),
  ('nature_trails', 'natural_cave', 'מערות טבע', 10),
  ('nature_trails', 'hanging_bridge', 'גשרים תלויים', 11),
  ('nature_trails', 'accessible_trail', 'מסלולים נגישים', 12),
  ('nature_trails', 'special_nature_site', 'אתרי טבע מיוחדים', 13),
  ('beaches_pools', 'sea_beach', 'חופי ים', 0),
  ('beaches_pools', 'kinneret_beach', 'חופי כנרת', 1),
  ('beaches_pools', 'lake', 'אגמים', 2),
  ('beaches_pools', 'natural_pool', 'בריכות טבעיות', 3),
  ('beaches_pools', 'wading_pool', 'בריכות שכשוך', 4),
  ('beaches_pools', 'lagoon', 'לגונות', 5),
  ('beaches_pools', 'organized_beach', 'חופים מוסדרים', 6),
  ('beaches_pools', 'wild_beach', 'חופים פראיים', 7),
  ('beaches_pools', 'swimming_pool', 'בריכות שחייה', 8),
  ('beaches_pools', 'infinity_pool', 'בריכות אינפיניטי', 9),
  ('beaches_pools', 'family_beach', 'חופי רחצה למשפחות', 10),
  ('viewpoints', 'viewpoint', 'נקודות תצפית', 0),
  ('viewpoints', 'view_balcony', 'מרפסות נוף', 1),
  ('viewpoints', 'lookout', 'מצפורים', 2),
  ('viewpoints', 'mountain_view', 'תצפיות הרים', 3),
  ('viewpoints', 'city_view', 'תצפיות עירוניות', 4),
  ('viewpoints', 'sunrise_point', 'נקודות זריחה', 5),
  ('viewpoints', 'sunset_point', 'נקודות שקיעה', 6),
  ('viewpoints', 'night_view', 'תצפיות לילה', 7),
  ('viewpoints', 'stargazing', 'תצפיות כוכבים', 8),
  ('viewpoints', 'photo_spot', 'נקודות צילום מיוחדות', 9),
  ('parks_gardens', 'urban_park', 'פארקים עירוניים', 0),
  ('parks_gardens', 'national_park', 'פארקים לאומיים', 1),
  ('parks_gardens', 'botanical_garden', 'גנים בוטניים', 2),
  ('parks_gardens', 'flower_park', 'פארקי פרחים', 3),
  ('parks_gardens', 'sculpture_garden', 'גני פסלים', 4),
  ('parks_gardens', 'nature_park', 'פארקי טבע', 5),
  ('parks_gardens', 'picnic_park', 'פארקי פיקניק', 6),
  ('parks_gardens', 'public_garden', 'גנים ציבוריים', 7),
  ('parks_gardens', 'playground_complex', 'מתחמי משחק לילדים', 8),
  ('water_amusement_parks', 'water_park', 'פארקי מים', 0),
  ('water_amusement_parks', 'amusement_park', 'לונה פארקים', 1),
  ('water_amusement_parks', 'entertainment_park', 'פארקי שעשועים', 2),
  ('water_amusement_parks', 'trampoline_park', 'פארקי טרמפולינות', 3),
  ('water_amusement_parks', 'rope_park', 'פארקי חבלים', 4),
  ('water_amusement_parks', 'snow_park', 'פארקי שלג', 5),
  ('water_amusement_parks', 'adventure_park', 'פארקי אתגר', 6),
  ('water_amusement_parks', 'zipline', 'אומגות', 7),
  ('water_amusement_parks', 'climbing_wall', 'קירות טיפוס', 8),
  ('water_amusement_parks', 'extreme_facility', 'מתקני אקסטרים', 9),
  ('water_amusement_parks', 'big_play_area', 'מתחמי משחק גדולים', 10),
  ('attractions_activities', 'escape_room', 'חדרי בריחה', 0),
  ('attractions_activities', 'vr_venue', 'מתחמי VR', 1),
  ('attractions_activities', 'illusion_museum', 'מוזיאוני אשליות', 2),
  ('attractions_activities', 'workshop', 'סדנאות', 3),
  ('attractions_activities', 'self_picking_farm', 'קטיף עצמי', 4),
  ('attractions_activities', 'visitor_farm', 'חוות מבקרים', 5),
  ('attractions_activities', 'petting_zoo', 'פינות ליטוף', 6),
  ('attractions_activities', 'zoo', 'גני חיות', 7),
  ('attractions_activities', 'safari', 'ספארי', 8),
  ('attractions_activities', 'aquarium', 'אקווריומים', 9),
  ('attractions_activities', 'visitor_center', 'מרכזי מבקרים', 10),
  ('attractions_activities', 'cable_car', 'רכבלים', 11),
  ('attractions_activities', 'tourist_train', 'רכבות תיירותיות', 12),
  ('attractions_activities', 'guided_tour', 'סיורים מודרכים', 13),
  ('attractions_activities', 'family_activity', 'פעילויות לכל המשפחה', 14),
  ('sports_extreme', 'cycling', 'רכיבת אופניים', 0),
  ('sports_extreme', 'mountain_biking', 'אופני שטח', 1),
  ('sports_extreme', 'atv', 'טרקטורונים', 2),
  ('sports_extreme', 'raiser', 'רייזרים', 3),
  ('sports_extreme', 'jeep_tour', 'ג''יפים', 4),
  ('sports_extreme', 'horseback_riding', 'רכיבת סוסים', 5),
  ('sports_extreme', 'kayaking', 'קיאקים', 6),
  ('sports_extreme', 'sup', 'סאפ', 7),
  ('sports_extreme', 'surfing', 'גלישת גלים', 8),
  ('sports_extreme', 'windsurfing', 'גלישת רוח', 9),
  ('sports_extreme', 'diving', 'צלילה', 10),
  ('sports_extreme', 'snorkeling', 'שנורקל', 11),
  ('sports_extreme', 'climbing', 'טיפוס', 12),
  ('sports_extreme', 'bungee', 'בנג''י', 13),
  ('sports_extreme', 'paragliding', 'מצנחי רחיפה', 14),
  ('sports_extreme', 'water_skiing', 'סקי מים', 15),
  ('sports_extreme', 'wakeboarding', 'וויקבורד', 16),
  ('wineries_dining', 'winery', 'יקבים', 0),
  ('wineries_dining', 'brewery', 'מבשלות בירה', 1),
  ('wineries_dining', 'distillery', 'מזקקות', 2),
  ('wineries_dining', 'chef_restaurant', 'מסעדות שף', 3),
  ('wineries_dining', 'local_restaurant', 'מסעדות מקומיות', 4),
  ('wineries_dining', 'bakery', 'מאפיות', 5),
  ('wineries_dining', 'patisserie', 'קונדיטוריות', 6),
  ('wineries_dining', 'ice_cream_shop', 'גלידריות', 7),
  ('wineries_dining', 'food_market', 'שווקי אוכל', 8),
  ('wineries_dining', 'food_complex', 'מתחמי אוכל', 9),
  ('wineries_dining', 'wine_tasting', 'טעימות יין', 10),
  ('wineries_dining', 'beer_tasting', 'טעימות בירה', 11),
  ('wineries_dining', 'culinary_tour', 'סיורים קולינריים', 12),
  ('culture_history', 'museum', 'מוזיאונים', 0),
  ('culture_history', 'heritage_site', 'אתרי מורשת', 1),
  ('culture_history', 'archaeological_site', 'אתרים ארכאולוגיים', 2),
  ('culture_history', 'fortress', 'מבצרים', 3),
  ('culture_history', 'citadel', 'מצודות', 4),
  ('culture_history', 'historic_building', 'מבנים היסטוריים', 5),
  ('culture_history', 'church', 'כנסיות', 6),
  ('culture_history', 'monastery', 'מנזרים', 7),
  ('culture_history', 'ancient_synagogue', 'בתי כנסת עתיקים', 8),
  ('culture_history', 'mosque', 'מסגדים', 9),
  ('culture_history', 'gallery', 'גלריות', 10),
  ('culture_history', 'exhibition', 'תערוכות', 11),
  ('culture_history', 'culture_center', 'מרכזי תרבות', 12),
  ('culture_history', 'artists_village', 'כפרי אמנים', 13),
  ('culture_history', 'historic_street', 'רחובות היסטוריים', 14),
  ('shopping', 'mall', 'קניונים', 0),
  ('shopping', 'shopping_center', 'מרכזי קניות', 1),
  ('shopping', 'outlet', 'אאוטלטים', 2),
  ('shopping', 'market', 'שווקים', 3),
  ('shopping', 'food_market_shopping', 'שוקי אוכל', 4),
  ('shopping', 'flea_market', 'שוקי פשפשים', 5),
  ('shopping', 'artisan_fair', 'ירידי אומנים', 6),
  ('shopping', 'boutique', 'חנויות בוטיק', 7),
  ('shopping', 'open_shopping_area', 'מתחמי קניות פתוחים', 8),
  ('shopping', 'local_shop', 'חנויות מקומיות', 9),
  ('events_festivals', 'festival', 'פסטיבלים', 0),
  ('events_festivals', 'fair', 'ירידים', 1),
  ('events_festivals', 'live_show', 'הופעות חיות', 2),
  ('events_festivals', 'street_performance', 'מופעי רחוב', 3),
  ('events_festivals', 'food_festival', 'פסטיבלי אוכל', 4),
  ('events_festivals', 'wine_beer_festival', 'פסטיבלי יין ובירה', 5),
  ('events_festivals', 'culture_event', 'אירועי תרבות', 6),
  ('events_festivals', 'sports_event', 'אירועי ספורט', 7),
  ('events_festivals', 'night_market', 'שווקי לילה', 8),
  ('events_festivals', 'seasonal_event', 'אירועים עונתיים', 9),
  ('events_festivals', 'local_celebration', 'חגיגות מקומיות', 10),
  ('spa_relaxation', 'spa_complex', 'מתחמי ספא', 0),
  ('spa_relaxation', 'massage', 'עיסויים', 1),
  ('spa_relaxation', 'hammam', 'חמאם', 2),
  ('spa_relaxation', 'sauna', 'סאונה', 3),
  ('spa_relaxation', 'bathhouse', 'מרחצאות', 4),
  ('spa_relaxation', 'hot_spring', 'מעיינות חמים', 5),
  ('spa_relaxation', 'thermal_pool', 'בריכות תרמיות', 6),
  ('spa_relaxation', 'wellness_complex', 'מתחמי Wellness', 7),
  ('spa_relaxation', 'relaxation_complex', 'מתחמי רוגע', 8),
  ('spa_relaxation', 'nature_yoga', 'יוגה בטבע', 9),
  ('spa_relaxation', 'meditation', 'מדיטציה', 10),
  ('spa_relaxation', 'retreat', 'ריטריטים', 11)
) as sub(parent_value, value, label_he, sort_order) on sub.parent_value = inserted_groups.value
on conflict (taxonomy_group, value) do nothing;
