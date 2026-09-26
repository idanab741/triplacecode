# TRIPLACE

TRIPLACE הוא פרויקט אפליקציית ווב הנבנה בטכנולוגיית Next.js, עם תמיכה מלאה בעברית וכיווניות מימין-לשמאל (RTL).

## טכנולוגיות

- **Next.js** (App Router) — מסגרת העבודה (Framework) הראשית
- **TypeScript** — לכתיבת קוד בטוח יותר
- **Tailwind CSS** — לעיצוב ולסגנון
- **ESLint** — לבדיקת איכות הקוד

## מבנה התיקיות

כל הקוד של הפרויקט נמצא בתוך תיקיית `src`, ומחולק לתיקיות הבאות לפי תפקיד:

| תיקייה | תפקיד |
|---|---|
| `app` | הנתיבים (Routes) והעמודים של האפליקציה, לפי מוסכמות App Router |
| `components` | רכיבי ממשק (UI) לשימוש חוזר |
| `screens` | מסכים שלמים המורכבים מכמה רכיבים |
| `features` | קוד המאורגן לפי תכונה עסקית (Feature) |
| `services` | תקשורת עם שירותים חיצוניים ו-API |
| `hooks` | הוקים (Hooks) מותאמים אישית של React |
| `providers` | ספקי הקשר (Context Providers) גלובליים |
| `contexts` | הגדרות של React Context |
| `database` | קוד הקשור למסד הנתונים (Supabase) |
| `types` | הגדרות טיפוסים (Types) של TypeScript |
| `utils` | פונקציות עזר כלליות |
| `constants` | קבועים בשימוש ברחבי הפרויקט |
| `theme` | הגדרות עיצוב, צבעים וסגנון |
| `animations` | הגדרות ואפקטים של אנימציה |
| `assets` | קבצים סטטיים כמו תמונות ואייקונים |
| `locales` | קבצי תרגום ולוקליזציה |
| `api` | נקודות קצה (Endpoints) פנימיות של השרת |
| `admin` | קוד הקשור לממשק הניהול |
| `shared` | קוד משותף בין חלקים שונים של האפליקציה |

## הגדרת סביבה

יש למלא בקובץ `.env.local` את מפתחות ה-API הנדרשים (Supabase, Google Maps). קובץ זה אינו מועלה ל-git.

## הרצה מקומית

```bash
npm run dev
```

לאחר מכן יש לגלוש לכתובת [http://localhost:3000](http://localhost:3000).

## Deployment

Production runs on the Vercel project **triplacecode2.0**, which deploys `main` automatically on every merge.
The Vercel Hobby plan allows 100 deployments per day across all projects connected to this repo,
so only triplacecode2.0 should stay connected. When a deploy is rate limited, redeploy later from
Vercel → Deployments → ⋯ → Create Deployment → `main`.
