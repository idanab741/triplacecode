-- *** תיקון-שורש (בקשה מפורשת - "אותה כרטיסייה חוזרת אחרי שנייה
-- שהחלקת עליה... תיצור פלואו מושלם"): recordTripMatchDecision הישן
-- (ב-tripMatchService.ts) קרא את הסשן, הוסיף placeId למערך
-- liked_place_ids/rejected_place_ids *בזיכרון*, וכתב את המערך המלא
-- בחזרה - read-modify-write לא אטומי. כששני swipes רצופים על אותו
-- session מגיעים קרוב מדי בזמן (בדיוק המצב שגרימת אליו כשהזרימה
-- מהירה), הקריאה השנייה קוראת את הסשן *לפני* שהכתיבה של הראשונה
-- הספיקה להיכתב ל-DB - הכתיבה השנייה דורסת את השינוי של הראשונה,
-- וה-placeId הראשון "נשכח" מהחרגה. fetchTripMatchCandidates (שמחריג
-- לפי liked_place_ids/rejected_place_ids) לא רואה אותו כמוחלט יותר,
-- והוא חוזר להופיע כמועמד בסבב הבא - זה בדיוק "הכרטיסייה חוזרת".
--
-- הפונקציה הזו עושה append אטומי בתוך שאילתת ה-UPDATE עצמה
-- (array_append + בדיקת "עדיין לא שם" כחלק מאותה טרנזקציה) - אין
-- יותר חלון-זמן שבו קריאה שנייה יכולה לדרוס את הראשונה.
create or replace function tripmatch_record_decision(
  p_session_id uuid,
  p_place_id text,
  p_liked boolean
) returns void
language sql
as $$
  update tripmatch_sessions
  set
    liked_place_ids = case
      when p_liked and not (p_place_id = any(liked_place_ids))
        then array_append(liked_place_ids, p_place_id)
      else liked_place_ids
    end,
    rejected_place_ids = case
      when not p_liked and not (p_place_id = any(rejected_place_ids))
        then array_append(rejected_place_ids, p_place_id)
      else rejected_place_ids
    end
  where id = p_session_id;
$$;
