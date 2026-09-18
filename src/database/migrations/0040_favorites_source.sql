-- מוסיף עמודת "מקור" ל-favorites, כדי שאפשר יהיה להבחין בין לייק שנעשה
-- ב-TripMatch לבין לייק שנעשה תוך כדי בניית מסלול (day trip/romantic
-- date/nightlife וכו') - שני התהליכים כותבים לאותה טבלה משותפת, ולכן
-- לשונית "לייקים" בעמוד "כל הטיולים" הציגה גם דברים שלא קשורים ל-TripMatch.
-- ברירת מחדל null - שורות ישנות (לפני המיגרציה) יישארו לא מסווגות.

alter table favorites
  add column if not exists source text;
