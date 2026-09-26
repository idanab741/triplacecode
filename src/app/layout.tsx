import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { AuthProvider } from "@/providers/AuthProvider";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
});

export const metadata: Metadata = {
  title: "TRIPLACE",
  description: "TRIPLACE",
  // *** בקשה מפורשת ("העמודים נגמרים למעלה ויש שם לבן - באפליקציות אחרות זה על כל העמוד"): כשפותחים מאייקון
  // במסך הבית, העמוד נמשך גם מתחת לסרגל הסטטוס (שעה/סוללה) במקום פס לבן. ר' --sat ב-globals.css.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "triplace" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  // מאפשר לתוכן להיכנס מתחת לסרגל הסטטוס / ה-notch; env(safe-area-inset-*) מקבלים ערכים אמיתיים
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-secondary">
        <div className="status-scrim" aria-hidden="true" />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
