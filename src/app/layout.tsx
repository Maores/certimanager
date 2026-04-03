import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="he" dir="rtl" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
