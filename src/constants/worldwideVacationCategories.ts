/**
 * "רשימה של כל סוג טיול, בתוכו יעדים מותאמים" (Audit - הרשימה המלאה
 * שסופקה, 16 קטגוריות): נתונים סטטיים וקבועים, בדיוק כמו
 * israelVacationDestinations.ts - אבל כאן כל יעד גם מתואם (server-side,
 * ר' /api/discovery/worldwide-categories) לרשומה אמיתית בטבלת
 * destinations לפי שם, כדי שהקליק יוביל לדף היעד האמיתי הקיים
 * (/destination/[id]) כשיש התאמה.
 *
 * מבנה דו-שכבתי בכוונה (לא לשכפל "סנטוריני"/"מיקונוס" 4 פעמים עם 4
 * תמונות שונות): WORLDWIDE_DESTINATION_REGISTRY הוא מקור-אמת יחיד לכל
 * יעד ייחודי (שם, דגל, נתיב תמונה) - הקטגוריות למטה רק *מפנות* ל-slug,
 * לפעמים עם subtitle קטגוריה-ספציפי (כמו "בכריסמס" ל"ניו יורק" בקטגוריית
 * חופשות עונתיות).
 */

export interface WorldwideDestinationRef {
  slug: string;
  /** תיאור קצר ספציפי-לקטגוריה (למשל "בכריסמס", "משחקי NBA") - לא חלק
   *  מהזהות של היעד עצמו, ר' WORLDWIDE_DESTINATION_REGISTRY לזה. */
  subtitle?: string;
  /**
   * תיקון (Audit - "תמונה של ניו יורק בכריסמס / ברצלונה באירועי ספורט"):
   * חלק מהתמונות שסופקו הן **הקשר-ספציפיות**, לא תמונת-נוף כללית של
   * היעד - "ברצלונה" בקטגוריית "אירועי ספורט" (קמפ נואו) שונה לגמרי
   * מ"ברצלונה" ב"נוודות דיגיטלית"/"חיי לילה". אופציונלי - כשלא מוגדר,
   * נופלים לתמונת ברירת המחדל של היעד ב-WORLDWIDE_DESTINATION_REGISTRY
   * (כמו קודם). כשמוגדר - עוקף אותה **רק בהופעה הזו הספציפית**, לא
   * משנה את התמונה שמוצגת בהופעות אחרות של אותו slug בקטגוריות אחרות.
   */
  imageUrl?: string;
}

export interface WorldwideVacationCategory {
  id: string;
  emoji: string;
  title: string;
  /** אייקון תמונה אמיתי לכותרת הסקשן (בקשה מפורשת - "עם האייקון מעמוד
   *  PUBLIC IMAGE") - נתיב צפוי, ממתין לקובץ בפועל (כמו imageUrl ביעדים). */
  iconUrl: string;
  destinations: WorldwideDestinationRef[];
}

export interface WorldwideDestinationEntry {
  name: string;
  flag: string;
  /** נתיב תמונה מקומי צפוי - **לא** image_url מטבלת destinations (בקשה
   *  מפורשת: תמונות חדשות, לא מה שכבר קיים ב-DB). */
  imageUrl: string;
}

/** מקור-אמת יחיד לכל יעד ייחודי ברשימה - כל slug מופיע כאן בדיוק פעם אחת. */
export const WORLDWIDE_DESTINATION_REGISTRY: Record<string, WorldwideDestinationEntry> = {
  paphos: { name: "פאפוס", flag: "🇨🇾", imageUrl: "/images/destination/papos.png" },
  crete: { name: "כרתים", flag: "🇬🇷", imageUrl: "/images/destination/crete.png" },
  mykonos: { name: "מיקונוס", flag: "🇬🇷", imageUrl: "/images/destination/mykonos.png" },
  santorini: { name: "סנטוריני", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/santorini.png" },
  rhodes: { name: "רודוס", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/rhodes.png" },
  kos: { name: "קוס", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/kos.png" },
  montenegro: { name: "מונטנגרו", flag: "🇲🇪", imageUrl: "/images/worldwide-destinations/montenegro.png" },
  phuket: { name: "פוקט", flag: "🇹🇭", imageUrl: "/images/destination/pocket.png" },
  larnaca: { name: "לרנקה", flag: "🇨🇾", imageUrl: "/images/worldwide-destinations/larnaca.png" },
  batumi: { name: "בטומי", flag: "🇬🇪", imageUrl: "/images/destination/batumi.png" },
  bucharest: { name: "בוקרשט", flag: "🇷🇴", imageUrl: "/images/destination/bucharest.png" },
  sofia: { name: "סופיה", flag: "🇧🇬", imageUrl: "/images/worldwide-destinations/sofia.png" },
  belgrade: { name: "בלגרד", flag: "🇷🇸", imageUrl: "/images/worldwide-destinations/belgrade.png" },
  "monte-carlo": { name: "מונטה קרלו", flag: "🇲🇨", imageUrl: "/images/worldwide-destinations/monte-carlo.png" },
  cyprus: { name: "קפריסין", flag: "🇨🇾", imageUrl: "/images/worldwide-destinations/cyprus.png" },
  macau: { name: "מקאו", flag: "🇲🇴", imageUrl: "/images/worldwide-destinations/macau.png" },
  "las-vegas": { name: "לאס וגאס", flag: "🇺🇸", imageUrl: "/images/worldwide-destinations/las-vegas.png" },
  budapest: { name: "בודפשט", flag: "🇭🇺", imageUrl: "/images/destination/budapest.png" },
  varna: { name: "ורנה", flag: "🇧🇬", imageUrl: "/images/worldwide-destinations/varna.png" },
  sarande: { name: "סרנדה", flag: "🇦🇱", imageUrl: "/images/worldwide-destinations/sarande.png" },
  dubai: { name: "דובאי", flag: "🇦🇪", imageUrl: "/images/worldwide-destinations/dubai.png" },
  "new-york": { name: "ניו יורק", flag: "🇺🇸", imageUrl: "/images/destination/newyork.png" },
  tokyo: { name: "טוקיו", flag: "🇯🇵", imageUrl: "/images/destination/tokio.png" },
  paris: { name: "פריז", flag: "🇫🇷", imageUrl: "/images/destination/paris.png" },
  amsterdam: { name: "אמסטרדם", flag: "🇳🇱", imageUrl: "/images/worldwide-destinations/amsterdam.png" },
  lapland: { name: "לפלנד", flag: "🇫🇮", imageUrl: "/images/worldwide-destinations/lapland.png" },
  munich: { name: "מינכן", flag: "🇩🇪", imageUrl: "/images/worldwide-destinations/munich.png" },
  vienna: { name: "וינה", flag: "🇦🇹", imageUrl: "/images/destination/vienna.png" },
  london: { name: "לונדון", flag: "🇬🇧", imageUrl: "/images/destination/london.png" },
  kyoto: { name: "קיוטו", flag: "🇯🇵", imageUrl: "/images/worldwide-destinations/kyoto.png" },
  "amalfi-coast": { name: "חוף אמלפי", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/amalfi-coast.png" },
  "lake-como": { name: "אגם קומו", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/lake-como.png" },
  venice: { name: "ונציה", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/venice.png" },
  lucerne: { name: "לוצרן", flag: "🇨🇭", imageUrl: "/images/worldwide-destinations/lucerne.png" },
  salzburg: { name: "זלצבורג", flag: "🇦🇹", imageUrl: "/images/worldwide-destinations/salzburg.png" },
  "french-riviera": { name: "הריביירה הצרפתית", flag: "🇫🇷", imageUrl: "/images/worldwide-destinations/french-riviera.png" },
  florence: { name: "פירנצה", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/florence.png" },
  bruges: { name: "ברוז'", flag: "🇧🇪", imageUrl: "/images/worldwide-destinations/bruges.png" },
  brussels: { name: "בריסל", flag: "🇧🇪", imageUrl: "/images/worldwide-destinations/brussels.png" },
  barcelona: { name: "ברצלונה", flag: "🇪🇸", imageUrl: "/images/destination/imgaebarcelona.png" },
  "rio-de-janeiro": { name: "ריו דה ז'ניירו", flag: "🇧🇷", imageUrl: "/images/worldwide-destinations/rio-de-janeiro.png" },
  ibiza: { name: "איביזה", flag: "🇪🇸", imageUrl: "/images/worldwide-destinations/ibiza.png" },
  lisbon: { name: "ליסבון", flag: "🇵🇹", imageUrl: "/images/worldwide-destinations/lisbon.png" },
  bangkok: { name: "בנגקוק", flag: "🇹🇭", imageUrl: "/images/worldwide-destinations/bangkok.png" },
  bali: { name: "באלי", flag: "🇮🇩", imageUrl: "/images/worldwide-destinations/bali.png" },
  tbilisi: { name: "טביליסי", flag: "🇬🇪", imageUrl: "/images/worldwide-destinations/tbilisi.png" },
  medellin: { name: "מדיין", flag: "🇨🇴", imageUrl: "/images/worldwide-destinations/medellin.png" },
  madeira: { name: "מדיירה", flag: "🇵🇹", imageUrl: "/images/worldwide-destinations/madeira.png" },
  "da-nang": { name: "דה נאנג", flag: "🇻🇳", imageUrl: "/images/worldwide-destinations/da-nang.png" },
  athens: { name: "אתונה", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/athens.png" },
  milan: { name: "מילאנו", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/milan.png" },
  zurich: { name: "ציריך", flag: "🇨🇭", imageUrl: "/images/worldwide-destinations/zurich.png" },
  marbella: { name: "מרבלה", flag: "🇪🇸", imageUrl: "/images/worldwide-destinations/marbella.png" },
  paros: { name: "פארוס", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/paros.png" },
  zakynthos: { name: "זקינטוס", flag: "🇬🇷", imageUrl: "/images/worldwide-destinations/zakynthos.png" },
  "koh-samui": { name: "קוסמוי", flag: "🇹🇭", imageUrl: "/images/worldwide-destinations/koh-samui.png" },
  "costa-rica": { name: "קוסטה ריקה", flag: "🇨🇷", imageUrl: "/images/worldwide-destinations/costa-rica.png" },
  "val-thorens": { name: "ואל טורנס", flag: "🇫🇷", imageUrl: "/images/destination/val-thorens.png" },
  bansko: { name: "בנסקו", flag: "🇧🇬", imageUrl: "/images/worldwide-destinations/bansko.png" },
  gudauri: { name: "גודאורי", flag: "🇬🇪", imageUrl: "/images/worldwide-destinations/gudauri.png" },
  ischgl: { name: "אישגל", flag: "🇦🇹", imageUrl: "/images/worldwide-destinations/ischgl.png" },
  solden: { name: "סולדן", flag: "🇦🇹", imageUrl: "/images/worldwide-destinations/solden.png" },
  chamonix: { name: "שאמוני", flag: "🇫🇷", imageUrl: "/images/worldwide-destinations/chamonix.png" },
  meribel: { name: "מריבל", flag: "🇫🇷", imageUrl: "/images/worldwide-destinations/meribel.png" },
  kitzbuhel: { name: "קיצביל", flag: "🇦🇹", imageUrl: "/images/worldwide-destinations/kitzbuhel.png" },
  zermatt: { name: "צרמט", flag: "🇨🇭", imageUrl: "/images/worldwide-destinations/zermatt.png" },
  "los-angeles": { name: "לוס אנג'לס", flag: "🇺🇸", imageUrl: "/images/worldwide-destinations/los-angeles.png" },
  madrid: { name: "מדריד", flag: "🇪🇸", imageUrl: "/images/worldwide-destinations/madrid.png" },
  monza: { name: "מונזה", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/monza.png" },
  "abu-dhabi": { name: "אבו דאבי", flag: "🇦🇪", imageUrl: "/images/worldwide-destinations/abu-dhabi.png" },
  thailand: { name: "תאילנד", flag: "🇹🇭", imageUrl: "/images/worldwide-destinations/thailand.png" },
  vietnam: { name: "וייטנאם", flag: "🇻🇳", imageUrl: "/images/worldwide-destinations/vietnam.png" },
  india: { name: "הודו", flag: "🇮🇳", imageUrl: "/images/worldwide-destinations/india.png" },
  nepal: { name: "נפאל", flag: "🇳🇵", imageUrl: "/images/worldwide-destinations/nepal.png" },
  mexico: { name: "מקסיקו", flag: "🇲🇽", imageUrl: "/images/worldwide-destinations/mexico.png" },
  colombia: { name: "קולומביה", flag: "🇨🇴", imageUrl: "/images/worldwide-destinations/colombia.png" },
  argentina: { name: "ארגנטינה", flag: "🇦🇷", imageUrl: "/images/worldwide-destinations/argentina.png" },
  peru: { name: "פרו", flag: "🇵🇪", imageUrl: "/images/worldwide-destinations/peru.png" },
  brazil: { name: "ברזיל", flag: "🇧🇷", imageUrl: "/images/worldwide-destinations/brazil.png" },
  cuba: { name: "קובה", flag: "🇨🇺", imageUrl: "/images/worldwide-destinations/cuba.png" },
  bolivia: { name: "בוליביה", flag: "🇧🇴", imageUrl: "/images/worldwide-destinations/bolivia.png" },
  chile: { name: "צ'ילה", flag: "🇨🇱", imageUrl: "/images/worldwide-destinations/chile.png" },
  laos: { name: "לאוס", flag: "🇱🇦", imageUrl: "/images/worldwide-destinations/laos.png" },
  philippines: { name: "הפיליפינים", flag: "🇵🇭", imageUrl: "/images/worldwide-destinations/philippines.png" },
  zanzibar: { name: "זנזיבר", flag: "🇹🇿", imageUrl: "/images/worldwide-destinations/zanzibar.png" },
  seychelles: { name: "סיישל", flag: "🇸🇨", imageUrl: "/images/worldwide-destinations/seychelles.png" },
  mauritius: { name: "מאוריציוס", flag: "🇲🇺", imageUrl: "/images/worldwide-destinations/mauritius.png" },
  maldives: { name: "המלדיביים", flag: "🇲🇻", imageUrl: "/images/worldwide-destinations/maldives.png" },
  "sri-lanka": { name: "סרי לנקה", flag: "🇱🇰", imageUrl: "/images/worldwide-destinations/sri-lanka.png" },
  tulum: { name: "טולום", flag: "🇲🇽", imageUrl: "/images/worldwide-destinations/tulum.png" },
  fiji: { name: "פיג'י", flag: "🇫🇯", imageUrl: "/images/worldwide-destinations/fiji.png" },
  "phu-quoc": { name: "פו קווק", flag: "🇻🇳", imageUrl: "/images/worldwide-destinations/phu-quoc.png" },
  prague: { name: "פראג", flag: "🇨🇿", imageUrl: "/images/destination/prague.png" },
  berlin: { name: "ברלין", flag: "🇩🇪", imageUrl: "/images/worldwide-destinations/berlin.png" },
  "ayia-napa": { name: "איה נאפה", flag: "🇨🇾", imageUrl: "/images/worldwide-destinations/ayia-napa.png" },
  goa: { name: "גואה", flag: "🇮🇳", imageUrl: "/images/worldwide-destinations/goa.png" },
  "koh-phangan": { name: "קו פנגן", flag: "🇹🇭", imageUrl: "/images/worldwide-destinations/koh-phangan.png" },
  krabi: { name: "קראבי", flag: "🇹🇭", imageUrl: "/images/worldwide-destinations/krabi.png" },
  "sella-ronda": { name: "סלה רונדה", flag: "🇮🇹", imageUrl: "/images/worldwide-destinations/sella-ronda.png" },
};

export const WORLDWIDE_VACATION_CATEGORIES: WorldwideVacationCategory[] = [
  {
    id: "beaches-relax",
    emoji: "🏖️",
    title: "בטן גב וחופים",
    iconUrl: "/images/vacation-type-icons/beaches-relax.png",
    destinations: [
      { slug: "paphos" }, { slug: "crete" }, { slug: "mykonos" }, { slug: "phuket" },
      { slug: "santorini" }, { slug: "rhodes" }, { slug: "kos" }, { slug: "montenegro" }, { slug: "larnaca" },
      { slug: "krabi" },
    ],
  },
  {
    id: "casino-gambling",
    emoji: "🎰",
    title: "קזינו והימורים",
    iconUrl: "/images/vacation-type-icons/casino-gambling.png",
    destinations: [
      { slug: "bucharest" }, { slug: "budapest" }, { slug: "batumi" }, { slug: "sofia" },
      { slug: "belgrade" }, { slug: "monte-carlo" }, { slug: "macau" }, { slug: "las-vegas" },
    ],
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧‍👦",
    title: "חופשה משפחתית",
    iconUrl: "/images/vacation-type-icons/family.png",
    destinations: [
      { slug: "paphos" }, { slug: "crete" }, { slug: "budapest" }, { slug: "bucharest" }, { slug: "batumi" },
      { slug: "varna" }, { slug: "rhodes" }, { slug: "kos" }, { slug: "sarande" }, { slug: "dubai" },
    ],
  },
  {
    id: "seasonal",
    emoji: "🍂",
    title: "חופשות עונתיות",
    iconUrl: "/images/vacation-type-icons/seasonal.png",
    destinations: [
      { slug: "new-york", subtitle: "בכריסמס", imageUrl: "/images/destination/newyork-christmas.png" },
      { slug: "tokyo", subtitle: "בסאקורה", imageUrl: "/images/destination/tokyo-sakura.png" },
      { slug: "paris", subtitle: "בכריסמס", imageUrl: "/images/destination/paris-christmas.png" },
      { slug: "vienna", subtitle: "בכריסמס" },
      { slug: "london", subtitle: "בכריסמס", imageUrl: "/images/destination/london-christmas.png" },
      { slug: "amsterdam", subtitle: "בעונת הצבעונים", imageUrl: "/images/destination/amsterdam-tulips.png" },
      { slug: "lapland", subtitle: "בחורף" },
      { slug: "munich", subtitle: "באוקטוברפסט", imageUrl: "/images/destination/munich-oktoberfest.png" },
      { slug: "kyoto", subtitle: "בעונת השלכת" },
    ],
  },
  {
    id: "romantic-honeymoon",
    emoji: "💕",
    title: "חופשה רומנטית וירח דבש",
    iconUrl: "/images/vacation-type-icons/romantic-honeymoon.png",
    destinations: [
      { slug: "paris", imageUrl: "/images/destination/paris-romantic.png" },
      { slug: "santorini" }, { slug: "amalfi-coast" }, { slug: "lake-como" },
      { slug: "venice" }, { slug: "lucerne" }, { slug: "salzburg" }, { slug: "french-riviera" },
      { slug: "florence" }, { slug: "bruges" },
    ],
  },
  {
    id: "live-music-festivals",
    emoji: "🎵",
    title: "הופעות חיות ופסטיבלים",
    iconUrl: "/images/vacation-type-icons/live-music-festivals.png",
    destinations: [
      { slug: "budapest", subtitle: "Sziget Festival", imageUrl: "/images/destination/budapest-sziget.png" },
      { slug: "barcelona", subtitle: "Primavera Sound", imageUrl: "/images/destination/barcelona-primavera.png" },
      { slug: "london", subtitle: "הופעות ווסט אנד", imageUrl: "/images/destination/london-westend.png" },
      { slug: "new-york", subtitle: "Broadway", imageUrl: "/images/destination/newyork-broadway.png" },
      { slug: "brussels", subtitle: "Tomorrowland", imageUrl: "/images/destination/brussels-tomorrowland.png" },
      { slug: "amsterdam", subtitle: "Amsterdam Dance Event", imageUrl: "/images/destination/amsterdam-festival.png" },
      { slug: "las-vegas", subtitle: "מופעי ענק" },
      { slug: "munich", subtitle: "Oktoberfest", imageUrl: "/images/destination/munich-oktoberfest.png" },
      { slug: "berlin", subtitle: "אוקטוברפסט", imageUrl: "/images/destination/berlin-oktoberfest.png" },
      { slug: "rio-de-janeiro", subtitle: "Carnival", imageUrl: "/images/destination/rio-carnival.png" },
      { slug: "ibiza", subtitle: "פסטיבלי ומסיבות קיץ" },
    ],
  },
  {
    id: "digital-nomad",
    emoji: "💻",
    title: "נוודות דיגיטלית",
    iconUrl: "/images/vacation-type-icons/digital-nomad.png",
    destinations: [
      { slug: "barcelona" }, { slug: "lisbon" }, { slug: "bangkok" }, { slug: "bali" }, { slug: "tbilisi" },
      { slug: "medellin" }, { slug: "madeira" }, { slug: "da-nang" }, { slug: "athens" }, { slug: "goa" },
    ],
  },
  {
    id: "luxury",
    emoji: "💎",
    title: "יוקרה ופינוקים",
    iconUrl: "/images/vacation-type-icons/luxury.png",
    destinations: [
      { slug: "paris" }, { slug: "mykonos" }, { slug: "dubai" }, { slug: "milan" }, { slug: "lake-como" },
      { slug: "monte-carlo" }, { slug: "zurich" }, { slug: "french-riviera" }, { slug: "marbella" },
    ],
  },
  {
    id: "spa-wellness",
    emoji: "🧘",
    title: "ספא, וולנס וריטריטים",
    iconUrl: "/images/vacation-type-icons/spa-wellness.png",
    destinations: [
      { slug: "crete" }, { slug: "mykonos" }, { slug: "paros" }, { slug: "kos" }, { slug: "zakynthos" },
      { slug: "madeira" }, { slug: "bali" }, { slug: "koh-samui" }, { slug: "costa-rica" },
    ],
  },
  {
    id: "ski-winter-sports",
    emoji: "⛷️",
    title: "סקי וספורט חורף",
    iconUrl: "/images/vacation-type-icons/ski-winter-sports.png",
    destinations: [
      { slug: "val-thorens" }, { slug: "bansko" }, { slug: "gudauri" }, { slug: "sella-ronda" },
    ],
  },
  {
    id: "sports-events",
    emoji: "🏆",
    title: "אירועי ספורט",
    iconUrl: "/images/vacation-type-icons/sports-events.png",
    destinations: [
      { slug: "new-york", subtitle: "NBA", imageUrl: "/images/destination/newyork-nba.png" },
      { slug: "barcelona", subtitle: "משחקי ברצלונה", imageUrl: "/images/destination/barcelona-sports.png" },
      { slug: "madrid", subtitle: "ריאל מדריד", imageUrl: "/images/destination/madrid-sports.png" },
      { slug: "london", subtitle: "פרמייר ליג", imageUrl: "/images/destination/london-premierleague.png" },
      { slug: "paris", subtitle: "רולאן גארוס" },
      { slug: "paris", subtitle: "כדורגל", imageUrl: "/images/destination/paris-football.png" },
      { slug: "new-york", subtitle: "US Open", imageUrl: "/images/destination/newyork-usopen.png" },
      { slug: "los-angeles", subtitle: "NBA", imageUrl: "/images/destination/losangeles-nba.png" },
      { slug: "munich", subtitle: "באיירן מינכן", imageUrl: "/images/destination/munich-bayern.png" },
      { slug: "belgrade", subtitle: "דרבי הכוכב האדום ופרטיזן", imageUrl: "/images/destination/belgrade-derby.png" },
      { slug: "milan", subtitle: "דרבי מילאנו", imageUrl: "/images/destination/milan-derby.png" },
      { slug: "monza", subtitle: "פורמולה 1" },
      { slug: "abu-dhabi", subtitle: "פורמולה 1", imageUrl: "/images/destination/abudhabi-f1.png" },
    ],
  },
  {
    id: "backpacking",
    emoji: "🎒",
    title: "טיולי תרמילאים",
    iconUrl: "/images/vacation-type-icons/backpacking.png",
    destinations: [
      { slug: "thailand" }, { slug: "vietnam" }, { slug: "india" }, { slug: "nepal" }, { slug: "mexico" },
      { slug: "colombia" }, { slug: "argentina" }, { slug: "peru" }, { slug: "brazil" }, { slug: "cuba" },
      { slug: "bolivia" }, { slug: "chile" }, { slug: "laos" }, { slug: "philippines" },
    ],
  },
  {
    id: "tropical",
    emoji: "🌴",
    title: "חופשות טרופיות",
    iconUrl: "/images/vacation-type-icons/tropical.png",
    destinations: [
      { slug: "zanzibar" }, { slug: "seychelles" }, { slug: "mauritius" }, { slug: "philippines" },
      { slug: "koh-samui" }, { slug: "bali" }, { slug: "maldives" }, { slug: "sri-lanka" }, { slug: "tulum" },
      { slug: "costa-rica" }, { slug: "fiji" }, { slug: "phu-quoc" }, { slug: "goa" }, { slug: "koh-phangan" },
      { slug: "krabi" },
    ],
  },
  {
    id: "urban",
    emoji: "🏙️",
    title: "חופשה עירונית",
    iconUrl: "/images/vacation-type-icons/urban.png",
    destinations: [
      { slug: "london" }, { slug: "paris" }, { slug: "barcelona" }, { slug: "prague" }, { slug: "budapest" },
      { slug: "vienna" }, { slug: "new-york" }, { slug: "milan" }, { slug: "amsterdam" }, { slug: "milan" },
      { slug: "lisbon" }, { slug: "berlin" }, { slug: "madrid" },
    ],
  },
  {
    id: "nightlife-parties",
    emoji: "🌃",
    title: "מסיבות וחיי לילה",
    iconUrl: "/images/vacation-type-icons/nightlife-parties.png",
    destinations: [
      { slug: "mykonos" }, { slug: "bucharest" }, { slug: "budapest" }, { slug: "barcelona" },
      { slug: "ibiza" }, { slug: "belgrade" }, { slug: "athens" }, { slug: "ayia-napa" }, { slug: "berlin" },
      { slug: "amsterdam" }, { slug: "sofia" }, { slug: "dubai" }, { slug: "goa" }, { slug: "koh-phangan" },
    ],
  },
];

export interface CruiseLineEntry {
  slug: string;
  name: string;
  /** תמונת נוף של הספינה עצמה (לא לוגו) - אותו דפוס תמונה כמו יעד רגיל. */
  imageUrl: string;
}

export const CRUISE_LINES: CruiseLineEntry[] = [
  { slug: "royal-caribbean", name: "Royal Caribbean", imageUrl: "/images/cruise-lines/royal-caribbean.png" },
  { slug: "ncl", name: "Norwegian Cruise Line (NCL)", imageUrl: "/images/cruise-lines/ncl.png" },
  { slug: "msc", name: "MSC Cruises", imageUrl: "/images/cruise-lines/msc.png" },
  { slug: "mano", name: "מנו ספנות", imageUrl: "/images/cruise-lines/mano.png" },
  { slug: "costa", name: "Costa Cruises", imageUrl: "/images/cruise-lines/costa.png" },
];
