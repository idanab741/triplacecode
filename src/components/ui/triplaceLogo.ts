import type { CSSProperties } from "react";

/** לוגו triplace בשחור, באותה תיבה כמו בבר העליון (בקשה מפורשת: שחור בכל העמודים - סגול רק
 *  בעמוד הבית). נצבע דרך CSS mask מקובץ הלוגו, כך שהצבע נשלט מכאן במקום אחד. */
export const TRIPLACE_LOGO_STYLE: CSSProperties = {
  backgroundColor: "#000000",
  WebkitMaskImage: "url(/images/triplace-logo-black.png)",
  maskImage: "url(/images/triplace-logo-black.png)",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};
