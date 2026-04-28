import type { Metadata } from "next";
import { Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["300", "400", "500", "600", "700"],
  display: "optional",
  variable: "--font-noto-hebrew",
});

export const metadata: Metadata = {
  title: "CertiManager - ניהול הסמכות",
  description: "מערכת לניהול ומעקב אחר הסמכות עובדים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`h-full ${notoHebrew.variable}`}>
      <body className="h-full overflow-x-clip">{children}</body>
    </html>
  );
}
