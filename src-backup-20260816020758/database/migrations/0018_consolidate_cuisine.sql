-- ========================================================================
-- Migration 0018: איחוד "מטבח/קולינריה" - שלוש רשימות (culinary_style,
-- cuisine_tag, ועוד רשימה בקוד שלא הייתה ב-DB כלל) לקבוצה אחת חדשה 'cuisine'
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- עקרון: לא מוחקים כלום. הקבוצות הישנות (culinary_style, cuisine_tag)
-- מסומנות is_active=false (נשארות ב-DB להיסטוריה/תאימות), והקבוצה החדשה
-- 'cuisine' היא מעכשיו המקור היחיד - עם מזהה (value) יציב אחד לכל מושג,
-- גם כשבקוד היום יש 2-3 מזהים שונים לאותו מושג (bbq/meat_bbq/meat_grill וכו').
-- ========================================================================

update public.taxonomy_terms
set is_active = false
where taxonomy_group in ('culinary_style', 'cuisine_tag');

insert into public.taxonomy_terms (taxonomy_group, value, label_he, emoji, sort_order) values
  ('cuisine', 'israeli_middle_eastern', 'ישראלי ומזרח תיכוני', '🥙', 1),
  ('cuisine', 'italian', 'איטלקי', '🍝', 2),
  ('cuisine', 'asian', 'אסייתי', '🥢', 3),
  ('cuisine', 'meat_bbq', 'בשרים ועל האש', '🍖', 4),
  ('cuisine', 'burger_diner', 'המבורגר ודיינר אמריקאי', '🍔', 5),
  ('cuisine', 'mexican', 'מקסיקני', '🌮', 6),
  ('cuisine', 'greek', 'יווני', '🫓', 7),
  ('cuisine', 'french_bistro', 'ביסטרו צרפתי', '🥖', 8),
  ('cuisine', 'indian', 'הודי', '🍛', 9),
  ('cuisine', 'mediterranean', 'ים־תיכוני', '🫒', 10),
  ('cuisine', 'seafood', 'דגים ופירות ים', '🐟', 11),
  ('cuisine', 'pizza', 'פיצה', '🍕', 12),
  ('cuisine', 'breakfast_brunch', 'ארוחת בוקר ובראנץ׳', '🥐', 13),
  ('cuisine', 'cafe', 'בית קפה', '☕', 14),
  ('cuisine', 'fine_dining', 'מסעדות שף', '👨‍🍳', 15),
  ('cuisine', 'desserts_sweets', 'קינוחים ומתוקים', '🍰', 16),
  ('cuisine', 'salads_healthy', 'סלטים ובריאות', '🥗', 17)
on conflict (taxonomy_group, value) do nothing;
