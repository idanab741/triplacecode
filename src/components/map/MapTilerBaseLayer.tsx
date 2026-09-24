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
interface MapTilerBaseLayerProps {
  /** *** חדש (מפת place's - "המפה צריכה להיות יותר ברורה"): "streets" = סגנון רחובות
   *  מלא וקריא (כבישים/שמות בולטים). ברירת המחדל "dataviz" - בדיוק כמו קודם, כדי לא
   *  לשנות את שאר המפות באפליקציה. */
  variant?: "dataviz" | "streets";
  /** *** חדש (מפת place's - בקשה מפורשת: "המפה נראית חיוורת ומרושלת"): צובע מחדש את
   *  סגנון DATAVIZ (הדהוי מטבעו) לפלטה חדה ונקייה - יבשה בהירה-חמימה, ים כחול ברור, פארקים
   *  ירוקים, כבישים לבנים ותוויות כהות עם הילה לבנה - ומסתיר גבולות מנהליים (הקווים המקווקווים
   *  הורודים) ו-POI. ברירת מחדל false - שאר המפות באפליקציה לא משתנות. */
  refined?: boolean;
}

/** פלטת המפה של place's (refined). */
const PALETTE = {
  land: "#F2F0EB",
  water: "#9DCBF0",
  park: "#D3EAC4",
  sand: "#EFE7D4",
  building: "#E3E0D8",
  road: "#FFFFFF",
  roadCasing: "#DCD8CF",
  label: "#3A3F4B",
  labelMinor: "#6B7080",
  halo: "#FFFFFF",
};

type AnyLayer = { id: string; type: string; "source-layer"?: string };
type MLMap = {
  setPaintProperty: (id: string, prop: string, value: unknown) => void;
  setLayoutProperty: (id: string, prop: string, value: unknown) => void;
};

/** צביעה מחדש בטוחה - כל קריאה עטופה, כי שמות/סוגי שכבות משתנים בין גרסאות סגנון. */
function paint(map: MLMap, id: string, prop: string, value: unknown) {
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    /* שכבה בלי המאפיין הזה - מדלגים */
  }
}

function applyRefinedPalette(map: MLMap, layers: AnyLayer[]) {
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const src = (layer["source-layer"] ?? "").toLowerCase();
    const key = `${id} ${src}`;

    // גבולות מנהליים, קווי מעבורות, POI ותוויות תחבורה - רעש. מוסתרים.
    if (
      (layer.type === "line" && /(border|boundary|admin|disputed|ferry)/.test(key)) ||
      (layer.type === "symbol" && /(poi|transit|station|aeroway|airport|housenumber|oneway|shield)/.test(key))
    ) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch {
        /* ignore */
      }
      continue;
    }

    if (layer.type === "background") {
      paint(map, layer.id, "background-color", PALETTE.land);
    } else if (layer.type === "fill") {
      if (/water|ocean|sea|lake|river/.test(key)) paint(map, layer.id, "fill-color", PALETTE.water);
      else if (/sand|beach/.test(key)) paint(map, layer.id, "fill-color", PALETTE.sand);
      else if (/park|wood|forest|grass|scrub|vegetation|nature|golf|garden/.test(key)) {
        paint(map, layer.id, "fill-color", PALETTE.park);
        paint(map, layer.id, "fill-opacity", 0.85);
      } else if (/building/.test(key)) paint(map, layer.id, "fill-color", PALETTE.building);
      else if (/landuse|residential|industrial|commercial|landcover/.test(key)) {
        paint(map, layer.id, "fill-color", PALETTE.land);
      }
    } else if (layer.type === "line") {
      if (/water|river|stream|canal|waterway/.test(key)) paint(map, layer.id, "line-color", PALETTE.water);
      else if (/road|highway|street|motorway|trunk|primary|secondary|tertiary|minor|path|transportation|bridge|tunnel/.test(key)) {
        paint(map, layer.id, "line-color", /casing|outline/.test(key) ? PALETTE.roadCasing : PALETTE.road);
      } else if (/rail/.test(key)) paint(map, layer.id, "line-color", PALETTE.roadCasing);
    } else if (layer.type === "symbol") {
      const major = /(country|state|city|capital|place)/.test(key) && !/(village|hamlet|suburb|neighbourhood|neighborhood)/.test(key);
      paint(map, layer.id, "text-color", major ? PALETTE.label : PALETTE.labelMinor);
      paint(map, layer.id, "text-halo-color", PALETTE.halo);
      paint(map, layer.id, "text-halo-width", 1.6);
      paint(map, layer.id, "text-halo-blur", 0.2);
    }
  }
}

export function MapTilerBaseLayer({ variant = "dataviz", refined = false }: MapTilerBaseLayerProps = {}) {
  const map = useMap();

  useEffect(() => {
    if (!MAPTILER_KEY) return;
    const layer = new MaptilerLayer({
      apiKey: MAPTILER_KEY,
      style: variant === "streets" ? MapStyle.STREETS : MapStyle.DATAVIZ,
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
      if (refined && style?.layers) {
        applyRefinedPalette(maplibreMap as unknown as MLMap, style.layers as unknown as AnyLayer[]);
      }
      style?.layers?.forEach((styleLayer) => {
        const id = styleLayer.id.toLowerCase();
        if (id.includes("disputed") || id.includes("boundary")) {
          maplibreMap.setLayoutProperty(styleLayer.id, "visibility", "none");
        }
      });

      // *** תיקון ודאי #2 (Bug - העיגול "N"/מצפן עדיין מופיע למרות
      // navigationControl:false שהועבר ל-constructor, וגם למרות ניסיון
      // הסתרה קודם ב-CSS לפי שם מחלקה מנוחש - שתי הגישות הסתמכו על
      // ניחוש API/class-name שהתברר כלא מדויק בפועל בגרסה הזו של
      // @maptiler/leaflet-maptilersdk. זו הפעם גישה שלא מנחשת שום דבר:
      // ברגע שהמפה "מוכנה" (ready), פשוט סורקים בפועל את ה-DOM האמיתי
      // בתוך ה-container הפנימי של MapLibre GL עצמו (maplibreMap.
      // getContainer() - שונה/מקונן בתוך ה-container של Leaflet, לא
      // אותו דבר) ומסתירים כל אלמנט עם "ctrl" בשם המחלקה שלו - זה תמיד
      // יתפוס את הבקרה בפועל כפי שהיא נוצרת בזמן ריצה, לא לפי שם קבוע
      // מהתיעוד. לא נוגע ב-container של Leaflet עצמו (leaflet-control-
      // zoom) - הוא חי בעץ DOM נפרד לגמרי, אז נשאר תקין.
      const maplibreContainer = maplibreMap.getContainer();
      maplibreContainer.querySelectorAll<HTMLElement>('[class*="ctrl"]').forEach((el) => {
        el.style.display = "none";
      });
    });

    return () => {
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, variant, refined]);

  return null;
}
