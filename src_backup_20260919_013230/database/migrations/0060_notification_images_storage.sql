-- ========================================================================
-- Migration 0060: Storage bucket "notification-images"
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- *** תוספת (בקשה מפורשת - "אפשרות להעלות תמונה מהמחשב"): אותו דפוס
-- בדיוק כמו place-images (migration 0008) - כתיבה רק דרך השרת
-- (service_role, ר' /api/admin/notifications/upload-image/route.ts,
-- לא ישירות מהלקוח - אין למשתמשי Admin session של Supabase Auth
-- בכלל, ההרשאה שלהם היא x-admin-secret בלבד), קריאה ציבורית (כדי
-- שהתמונה תוצג לכל משתמש שרואה את ההתראה, בלי צורך בהתחברות).

insert into storage.buckets (id, name, public)
values ('notification-images', 'notification-images', true)
on conflict (id) do nothing;

create policy "Notification images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'notification-images');
