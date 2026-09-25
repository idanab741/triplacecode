/**
 * העברת קבצים מעמוד "תוכן" לעמוד יצירת הפוסט: בוחרים תמונה/סרטון (מצלמה או גלריה) ב"רגע", והעמוד
 * הבא נפתח כשהם כבר בפנים. קבצים לא עוברים ב-URL, אז שומרים אותם בזיכרון - הניווט בתוך האפליקציה
 * (router.push) לא טוען את הדף מחדש. נלקחים פעם אחת בלבד.
 */
let pending: File[] | null = null;

export function setPendingCreateMedia(files: File[]) {
  pending = files.length > 0 ? files : null;
}

export function takePendingCreateMedia(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
