"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { MaptilerLayer, Language, MapStyle } from "@maptiler/leaflet-maptilersdk";
import { MAPTILER_KEY } from "@/constants/mapTiles";

/**
 * שכבת הבסיס הרשמית של MapTiler, דרך התוסף הרשמי
 * @maptiler/leaflet-maptilersdk. בניגוד ל-<TileLayer> הרגיל (שמצפה
 * ל-URL של אריחי PNG), הסגנון הזה וקטורי - אז מוסיפים אותו ישירות
 * ל-instance של המפה (useMap) ולא כ-JSX declarative, כי אין
 * ל-react-leaflet עטיפה מובנית לשכבה הזו.
 *
 * *** תיקון (בקשת המשתמש - "עברית בשמות" + "בצבעים שלנו"):
 * - עברית: לא ניחוש - מתועד רשמית ב-README של @maptiler/leaflet-
 *   maptilersdk שיש אופציית `language`, עם Language.HEBREW מוכן מראש.
 *   בלי זה, ברירת המחדל היא שפת הדפדפן/מערכת (באנגלית במקרה שלכם).
 * - סגנון: עברנו מ-"Base" (שהתברר כלא הכי מתאים) ל-DATAVIZ - הסגנון
 *   הרשמי של MapTiler בדיוק בשביל להציג עליו נתונים/סמנים משלך,
 *   עם הכי פחות "רעש" ויזואלי (המעט תוויות/צבעים הכי קרוב למה שביקשתם).
 * - צבעי המותג: אין אופציית "צבע" ישירה ב-API של השכבה עצמה (רק
 *   בחירה בין סגנונות מוכנים) - הפתרון האמיתי לטווח ארוך הוא לעצב
 *   סגנון מותאם אישית בכלי ה-Customize של MapTiler
 *   (https://cloud.maptiler.com/maps/ -> לחצן "Customize" על סגנון
 *   קיים) ולהחליף את ה-style כאן ל-URL של הסגנון המותאם. כפתרון מיידי,
 *   מגוונים דרך CSS filter (ר' globals.css, מחלקת map-branded) - אותה
 *   שיטה שכבר עבדה על אריחי OSM, הפעם על ה-canvas שה-SDK מצייר עליו
 *   (לא raster PNG, אז זה CSS filter רגיל על canvas - לא mix-blend-mode
 *   שהתברר כלא אמין, ר' הערה ב-globals.css).
 * - "הפסים"/הגבול השנוי-במחלוקת: מוסתר דרך אירוע "ready" למטה - הפעם
 *   מאומת ישירות מול הקוד המקומפל של החבילה (לא ניחוש), אחרי שניסיון
 *   קודם עם שם method שגוי (getMaptilerMap במקום getMaptilerSDKMap)
 *   קרס את המפה לגמרי.
 *
 * חובה: לרנדר את הרכיב הזה רק כשיש מפתח (בדוק IS_USING_FALLBACK_TILES
 * בקומפוננטה הקוראת) - אחרת MaptilerLayer יזרוק שגיאה על מפתח חסר.
 */
export function MapTilerBaseLayer() {
  const map = useMap();

  useEffect(() => {
    if (!MAPTILER_KEY) return;
    const layer = new MaptilerLayer({
      apiKey: MAPTILER_KEY,
      style: MapStyle.DATAVIZ,
      language: Language.HEBREW,
    }).addTo(map);

    // *** תיקון (בקשת המשתמש - "בלי הקו האדום"): הניסיון הקודם קרס עם
    // "getMaptilerMap is not a function" - ניחוש שגוי לגבי שם ה-method.
    // הפעם מאומת בפועל: התקנתי את @maptiler/leaflet-maptilersdk באופן
    // מקומי ובדקתי את קובצי ה-.d.ts וה-JS המקומפלים שלה ישירות - השם
    // הנכון הוא getMaptilerSDKMap() (לא getMaptilerMap()), והאירוע
    // "ready" באמת קיים ונורה בפועל (this.fire("ready") מאומת בקוד
    // המקומפל). ה-object שמוחזר הוא maplibregl.Map רגיל (ה-SDK של
    // MapTiler הוא הרחבה של MapLibre GL JS) - getStyle/setLayoutProperty
    // הם API סטנדרטי שלו.
    layer.on("ready", () => {
      const maplibreMap = layer.getMaptilerSDKMap();
      const style = maplibreMap.getStyle();
      style?.layers?.forEach((styleLayer) => {
        const id = styleLayer.id.toLowerCase();
        if (id.includes("disputed") || id.includes("boundary")) {
          maplibreMap.setLayoutProperty(styleLayer.id, "visibility", "none");
        }
      });
    });

    return () => {
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
