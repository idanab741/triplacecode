-- ========================================================================
-- Migration 0002: Storage bucket "avatars" + מדיניות גישה
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- הערה: קבצים נשמרים בנתיב "{user_id}/avatar.<ext>", כדי שהמדיניות
-- תוכל לזהות בעלות לפי תיקיית המשתמש.
-- ========================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- קריאה ציבורית (כל אחד יכול לצפות בתמונות הפרופיל)
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- כל משתמש יכול להעלות רק לתיקייה של עצמו
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- כל משתמש יכול לעדכן רק את הקבצים בתיקייה של עצמו
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
