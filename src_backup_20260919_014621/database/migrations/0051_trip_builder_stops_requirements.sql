-- ========================================================================
-- Migration 0051: trip_builder_stops - עמודת requirements (Slot
-- Requirements) - תיקון ארכיטקטוני (Audit מול "בחן מחדש את כל מנגנון
-- בניית המסלול" - "Places Come Last... Slot Requirements"): עד עכשיו
-- Slot נשא רק category+role גולמיים, בלי שום דרישה קונקרטית (סוג ארוחה,
-- האם צריך infantSafe, משך מועדף, זמן ביום). Retrieval/Ranking לא יכלו
-- "לדעת" למה ה-Slot הזה קיים, רק לאיזו קטגוריה לחפש.
--
-- עמודה זו שומרת את ה-SlotRequirements (ר' types.ts) שנקבעו ל-Slot
-- בזמן התכנון (categoryPlanForDay, לפני שנבחר מקום בפועל) - כדי
-- ש-Repair/Chat Edit/עריכה ידנית מאוחרת יותר עדיין "יזכרו" מה ה-Slot
-- הזה אמור לספק, לא רק category/role גולמיים.
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- תוספת בלבד (add column if not exists, nullable) - שום שורה קיימת לא
-- נמחקת/משתנה, ושום קוד קיים שלא יודע על העמודה הזו לא נשבר (ברירת
-- מחדל null = "אין דרישות מפורשות", בדיוק כמו note שכבר nullable).
-- ========================================================================

alter table public.trip_builder_stops
  add column if not exists requirements jsonb;
