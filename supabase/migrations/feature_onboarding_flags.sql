-- Feature Onboarding: דגלים נפרדים לכל מסך הסבר פיצ'ר, בנוסף ל-
-- intro_completed_at הקיים (שמשמש בתור main_onboarding_completed).
alter table profiles
  add column if not exists tripmatch_onboarding_completed_at timestamptz,
  add column if not exists chat_onboarding_completed_at timestamptz,
  add column if not exists planner_onboarding_completed_at timestamptz;
