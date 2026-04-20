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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full overflow-x-clip">{children}</body>
    </html>
  );
}
