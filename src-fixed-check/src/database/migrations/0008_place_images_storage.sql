-- ========================================================================
-- Migration 0008: Storage bucket "place-images"
-- מטרה: להוריד תמונות מגוגל פעם אחת בלבד (בזמן האיסוף) ולשמור אותן
-- אצלנו לצמיתות, כדי שלא נשלם לגוגל שוב על כל צפייה של משתמש בתמונה.
-- כתיבה רק דרך השרת (service_role), קריאה ציבורית.
-- ========================================================================

insert into storage.buckets (id, name, public)
values ('place-images', 'place-images', true)
on conflict (id) do nothing;

create policy "Place images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'place-images');
