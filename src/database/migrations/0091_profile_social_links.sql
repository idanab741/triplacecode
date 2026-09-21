-- ========================================================================
-- Migration 0091: place's — קישורי Instagram / TikTok בפרופיל
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- שומרים רק את ה-handle (בלי @ ובלי URL) - הקישור נבנה בקוד (instagram.com/{handle},
-- tiktok.com/@{handle}). ה-RLS הקיים על profiles ממשיך לחול (כל אחד רואה לפי
-- profile_visibility, רק הבעלים מעדכן) - לא נוספות מדיניות.
-- ========================================================================

alter table public.profiles
  add column if not exists instagram text,
  add column if not exists tiktok text;

alter table public.profiles
  drop constraint if exists profiles_instagram_check,
  drop constraint if exists profiles_tiktok_check;

alter table public.profiles
  add constraint profiles_instagram_check check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint profiles_tiktok_check check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$');

comment on column public.profiles.instagram is 'Instagram handle (בלי @).';
comment on column public.profiles.tiktok is 'TikTok handle (בלי @).';
