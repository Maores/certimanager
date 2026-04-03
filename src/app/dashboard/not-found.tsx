import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">הדף לא נמצא</h2>
      <p className="text-gray-500 mb-6">הדף שחיפשת אינו קיים או שהוסר.</p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        חזרה ללוח בקרה
      </Link>
    </div>
  );
}
