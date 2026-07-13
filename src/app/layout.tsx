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
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-secondary">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
