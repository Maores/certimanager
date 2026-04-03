import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="he" dir="rtl">
      <body className="h-full bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center px-4">
          <p className="text-6xl font-bold text-blue-600 mb-4">404</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            הדף לא נמצא
          </h1>
          <p className="text-gray-500 mb-6">
            הדף שחיפשת אינו קיים או שהוסר.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            חזרה ללוח בקרה
          </Link>
        </div>
      </body>
    </html>
  );
}
