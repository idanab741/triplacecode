/**
 * מסגרת המבצע בעמוד התפריט (/profile), מתחת לשם: "במיוחד להרצה: ללא הגבלת טריפים".
 * *** בקשה מפורשת - "שהמסגרת תהיה עם תנועה אנימטיבית": גבול גרדיאנט כחול שזורם סביב המסגרת (בלי ספריות, CSS בלבד)
 * וזוהר עדין שפועם מאחוריה. מכבד prefers-reduced-motion.
 * בלי מספר ובלי מונה - רק המשפט (בתקופת ההרצה אין חיוב ואין חסימה, UNLIMITED_TRIPS_PROMO ב-tokenCosts).
 * כרגע לא לחיץ: "המסע" שמסביר מה זה טריפים ייבנה אחרי שמאשרים יחד את התוכנית שלו.
 */
const CSS = `
.tp-frame { position:relative; border-radius:20px; padding:2.5px; background:linear-gradient(115deg,#22B8FD,#007CFE,#7DE3FF,#0A6DFE,#22B8FD); background-size:300% 300%; animation:tp-flow 4.5s linear infinite; }
.tp-frame::before { content:""; position:absolute; inset:-6px; z-index:-1; border-radius:26px; background:inherit; filter:blur(12px); opacity:.35; animation:tp-pulse 2.6s ease-in-out infinite; }
@keyframes tp-flow { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
@keyframes tp-pulse { 0%,100%{opacity:.18} 50%{opacity:.5} }
@media (prefers-reduced-motion: reduce) { .tp-frame, .tp-frame::before { animation:none !important; } }
`;

export function TripsPromoCard() {
  return (
    <div className="tp-frame">
      <style>{CSS}</style>
      <p className="rounded-[18px] bg-white px-4 py-3.5 text-center text-[14.5px] font-extrabold" style={{ color: "#0A6DFE" }}>
        במיוחד להרצה: ללא הגבלת טריפים
      </p>
    </div>
  );
}
