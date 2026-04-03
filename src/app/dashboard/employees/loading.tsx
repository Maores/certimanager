export default function EmployeesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 bg-gray-200 rounded" />
        <div className="h-10 w-28 bg-blue-100 rounded-lg" />
      </div>

      {/* Search bar */}
      <div className="h-10 w-full bg-gray-100 rounded-lg" />

      {/* Desktop table skeleton */}
      <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="flex px-6 py-3 gap-12">
            <div className="h-3 w-12 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-14 bg-gray-200 rounded" />
            <div className="h-3 w-14 bg-gray-200 rounded" />
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex px-6 py-4 gap-12 border-b border-gray-100"
          >
            <div className="h-4 w-28 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Mobile cards skeleton */}
      <div className="space-y-3 sm:hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
