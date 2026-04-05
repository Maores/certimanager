export default function ReportsLoading() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-100 rounded mt-2" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 space-y-2"
          >
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-100 rounded-lg" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Timeline section */}
      <div>
        <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
            >
              <div className="flex justify-between">
                <div className="h-5 w-20 bg-gray-200 rounded" />
                <div className="h-5 w-8 bg-gray-100 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Department table */}
      <div>
        <div className="h-6 w-36 bg-gray-200 rounded mb-4" />
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="h-10 bg-gray-50 border-b border-gray-200" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 px-5 py-3.5 border-b border-gray-100"
            >
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-16 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Missing certs */}
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 space-y-2"
            >
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
                <div className="h-5 w-24 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
