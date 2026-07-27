// scripts/seed-destinations-table.mjs
//
// ממלא את טבלת `destinations` (זו ששולפת ל-/api/places/cities autocomplete)
// במאות יעדים אמיתיים: שם, מדינה, google_place_id וקואורדינטות אמיתיות
// (דרך Google Places API), ותיאור שיווקי בעברית באותו סגנון של היעדים
// הקיימים (דרך Claude). לא נוגע ב-image_url - זה נשאר null, לא נדרש
// לאוטוקומפליט ואפשר להוסיף בנפרד בהמשך רק ליעדים נבחרים.
//
// שימוש:
//   node scripts/seed-destinations-table.mjs --limit=5
//   node scripts/seed-destinations-table.mjs
//
// דורש ב-.env.local: ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY,
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`❌ לא נמצא .env.local ב-${envPath}. הרץ מתיקיית שורש הפרויקט.`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
if (!GOOGLE_MAPS_API_KEY) missing.push("GOOGLE_MAPS_API_KEY");
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length > 0) {
  console.error(`❌ חסרים משתני סביבה ב-.env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const START = Number(args.start ?? 0);
const LIMIT = args.limit ? Number(args.limit) : Infinity;

const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "destinations.json"), "utf-8")
);

const progressPath = path.join(__dirname, "seed-destinations-table-progress.json");
function loadProgress() {
  if (fs.existsSync(progressPath)) return JSON.parse(fs.readFileSync(progressPath, "utf-8"));
  return { done: [] };
}
function saveProgress(progress) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** מחפש את היעד ב-Google Places (Find Place) - מקבל place_id + קואורדינטות אמיתיות. */
async function findPlace(city, country) {
  const query = `${city}, ${country}`;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id,geometry,name&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;
  return {
    placeId: candidate.place_id,
    lat: candidate.geometry?.location?.lat,
    lng: candidate.geometry?.location?.lng,
  };
}

async function callClaude(prompt, maxTokens = 300) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  const textBlock = (data.content ?? []).find((b) => b.type === "text" && b.text);
  if (!textBlock) throw new Error("Claude לא החזיר טקסט");
  return textBlock.text.trim();
}

/** מייצר תיאור שיווקי קצר בעברית, באותו סגנון של היעדים הקיימים בטבלה. */
async function generateDescription(city, country) {
  const prompt = `אתה כותב תוכן שיווקי לאפליקציית טיולים בעברית. תן לי תיאור קצר (משפט אחד, עד 25 מילים) ל${city}, ${country}, באותו סגנון בדיוק כמו הדוגמאות הבאות:

"עיר הספא והפרלמנט המרהיב על גדות הדנובה - אמבטיות תרמיות, גשרים מוארים וחיי לילה ססגוניים." (בודפשט)
"מטרופולין עולמי עם ביג בן, מוזיאונים חינמיים ותרבות עשירה - כל רחוב מספר סיפור אחר." (לונדון)
"עיר האורות - מגדל אייפל, הלובר, ורחובות שמזמינים טיול רומנטי עם קרואסון ביד." (פריז)

השב אך ורק במשפט התיאור עצמו, בעברית, בלי מרכאות ובלי שום טקסט נוסף.`;

  return callClaude(prompt);
}

async function destinationExists(city, country) {
  const { data } = await supabase
    .from("destinations")
    .select("id")
    .ilike("name", city)
    .ilike("country", country)
    .limit(1);
  return (data ?? []).length > 0;
}

async function main() {
  const progress = loadProgress();
  const slice = destinations.slice(START, START + LIMIT);

  console.log(`🚀 מתחיל: ${slice.length} יעדים (מתוך ${destinations.length} ברשימה)`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const destination of slice) {
    const key = `${destination.city}, ${destination.country}`;
    if (progress.done.includes(key)) {
      console.log(`⏭️  ${key} - כבר טופל בעבר`);
      continue;
    }

    try {
      const exists = await destinationExists(destination.city, destination.country);
      if (exists) {
        console.log(`⏭️  ${key} - כבר קיים בטבלה`);
        progress.done.push(key);
        saveProgress(progress);
        skipped += 1;
        continue;
      }

      const geo = await findPlace(destination.city, destination.country);
      if (!geo || geo.lat == null || geo.lng == null) {
        console.warn(`⚠️  ${key} - לא נמצא ב-Google Places, מדלג`);
        failed += 1;
        continue;
      }

      const description = await generateDescription(destination.city, destination.country);

      const { error } = await supabase.from("destinations").insert({
        name: destination.city,
        country: destination.country,
        google_place_id: geo.placeId,
        latitude: geo.lat,
        longitude: geo.lng,
        description,
        image_url: null,
      });

      if (error) throw new Error(error.message);

      console.log(`✅ ${key}`);
      inserted += 1;

      progress.done.push(key);
      saveProgress(progress);

      await sleep(250);
    } catch (err) {
      console.error(`❌ ${key}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\n✨ סיום. נוספו: ${inserted} | דולגו: ${skipped} | נכשלו: ${failed}`);
}

main().catch((err) => {
  console.error("שגיאה כללית:", err);
  process.exit(1);
});
