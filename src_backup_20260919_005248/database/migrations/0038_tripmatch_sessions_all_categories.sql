-- "קרוב אליי" -> מסך ביניים שבו המשתמש בוחר אם לראות את כל הקטגוריות
-- (מסעדות/חיי לילה/טבע/אטרקציות יחד) או קטגוריה ספציפית אחת, בטווח
-- הרדיוס. כשהדגל true - fetchTripMatchCandidates לא מסנן לפי category
-- בכלל (רק מוציא "מלונות"). ברירת המחדל false שומרת על ההתנהגות
-- הרגילה (סינון לפי category יחיד) בכל שאר הזרימות באפליקציה.

alter table tripmatch_sessions
  add column if not exists include_all_categories boolean not null default false;
