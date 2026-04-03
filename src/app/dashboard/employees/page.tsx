import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/types/database";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("employees").select("*").order("first_name");

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_number.ilike.%${q}%,department.ilike.%${q}%`
    );
  }

  const { data: employees } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
        <Link
          href="/dashboard/employees/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          + הוסף עובד
        </Link>
      </div>

      {/* Search bar */}
      <form method="GET" className="w-full">
        <div className="relative">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="חיפוש עובד..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </form>

      {!employees || employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-4 h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-500">לא נמצאו עובדים</p>
          <p className="mt-1 text-sm text-gray-400">
            התחל בהוספת עובד חדש למערכת
          </p>
          <Link
            href="/dashboard/employees/new"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + הוסף עובד
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    שם
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    מספר עובד
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    מחלקה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    טלפון
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(employees as Employee[]).map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/employees/${employee.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {employee.first_name} {employee.last_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.employee_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.department}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600" dir="ltr">
                      {employee.phone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="space-y-3 sm:hidden">
            {(employees as Employee[]).map((employee) => (
              <Link
                key={employee.id}
                href={`/dashboard/employees/${employee.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {employee.employee_number}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-500">
                  {employee.department && (
                    <p>מחלקה: {employee.department}</p>
                  )}
                  {employee.phone && (
                    <p dir="ltr" className="text-right">
                      {employee.phone}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
