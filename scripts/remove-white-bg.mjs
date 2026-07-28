// scripts/remove-white-bg.mjs
//
// הופך רקע לבן (או קרוב ללבן) לשקוף, בשתי תמונות המשחק (דמות + מזוודה)
// שנשמרו בטעות בלי ערוץ Alpha. משתמש ב-sharp (כבר מותקן בפרויקט אם
// Next.js משתמש בו לאופטימיזציית תמונות - אחרת: npm install sharp --save-dev).
//
// שימוש: node scripts/remove-white-bg.mjs

import sharp from "sharp";
import path from "node:path";

const FILES = ["public/images/game/suitcase-transparent.png"];
const WHITE_THRESHOLD = 235; // פיקסלים בהירים מזה (כמעט לבן) הופכים שקופים

async function removeWhiteBackground(filePath) {
  const image = sharp(filePath);
  const { width, height } = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[i + 3] = 0; // אלפא = 0 (שקוף לגמרי)
    }
  }

  await sharp(data, { raw: { width, height, channels: info.channels } })
    .png()
    .toFile(filePath.replace(".png", "-transparent.png"));

  console.log(`✅ נוצר: ${filePath.replace(".png", "-transparent.png")}`);
}

for (const file of FILES) {
  await removeWhiteBackground(path.resolve(file));
}

