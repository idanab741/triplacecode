-- *** מי הוסיף את המקום (בקשה מפורשת - "העליתי מקומות והם לא מופיעים ב'שלי'").
-- עד עכשיו places לא שמר מי יצר מקום שמשתמש הוסיף (source='user_review'): מקום שנוסף בלי
-- ביקורת לא היה משויך לאף אחד, ולכן לא הופיע במפה בכלל - לא ב"שלי" ולא ב"הכל".

alter table public.places
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists places_created_by_idx
  on public.places (created_by)
  where created_by is not null;

-- השלמה למקומות קיימים: בזרימת "הוסף מקום" הביקורת נכתבת מיד אחרי ההוספה, אז הכותב
-- של הביקורת הראשונה על מקום שנוסף ע"י משתמש הוא כמעט תמיד מי שהוסיף אותו.
-- מקומות שנוספו בלי שום ביקורת נשארים בלי שיוך (אין מידע ממנו אפשר לשחזר).
update public.places pl
set created_by = first_review.user_id
from (
  select distinct on (place_id) place_id, user_id
  from public.place_reviews
  order by place_id, created_at asc
) first_review
where pl.id = first_review.place_id
  and pl.source = 'user_review'
  and pl.created_by is null;
