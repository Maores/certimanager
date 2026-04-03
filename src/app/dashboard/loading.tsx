export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 rounded" />

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-5 space-y-2"
          >
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 w-16 bg-gray-200 rounded" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 border-b border-gray-100 flex gap-8"
            >
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
