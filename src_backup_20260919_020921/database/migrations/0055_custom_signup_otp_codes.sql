-- תיקון Product מפורש ("אני רוצה לקצר את קוד האימות במייל ל-4 ספרות"):
-- קוד ה-OTP המובנה של Supabase (GoTrue) לאימות אימייל קבוע על 6 ספרות
-- ולא ניתן לשינוי דרך שום הגדרת פרויקט (מאומת מול תיעוד Supabase -
-- זה בניגוד ל-SMS OTP, שכן ניתן להגדיר לו אורך). כדי לקבל קוד אמיתי
-- בן 4 ספרות, בונים כאן מנגנון OTP מותאם אישית משלנו - טבלה זו שומרת
-- את הקוד (hash בלבד, לא בטקסט גלוי) ואת תוקפו. אימות מוצלח מייצר
-- session אמיתי דרך admin.generateLink({type:'magiclink'}) + client-side
-- verifyOtp({token_hash, type:'magiclink'}) - כך שהנפקת ה-session עצמה
-- עדיין עוברת דרך מנגנון האבטחה המובנה של Supabase, ולא מומצאת מאפס.
create table if not exists custom_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists custom_otp_codes_email_idx on custom_otp_codes (email, created_at desc);

comment on table custom_otp_codes is
  'קודי אימות מותאמים אישית (4 ספרות) לאימות אימייל בהרשמה - עוקף את מגבלת 6 הספרות הקבועה של OTP המובנה של Supabase. code_hash הוא sha256(email:code), לעולם לא נשמר הקוד עצמו בטקסט גלוי. גישה רק דרך service_role (ר׳ src/services/auth/customOtpService.ts) - אין RLS policies מכוונות, הטבלה לא נגישה ללקוח כלל.';

alter table custom_otp_codes enable row level security;
-- בכוונה אין שום policy - הטבלה נגישה רק דרך service_role client (עוקף RLS
-- באופן מובנה), אף פעם לא דרך anon/authenticated מהלקוח.
