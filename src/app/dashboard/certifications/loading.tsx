export default function CertificationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 bg-gray-200 rounded" />
        <div className="h-10 w-32 bg-blue-100 rounded-lg" />
      </div>

      {/* Search */}
      <div className="h-10 w-full max-w-md bg-gray-100 rounded-lg" />

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-100 rounded-full" />
        ))}
      </div>

      {/* Count */}
      <div className="h-4 w-28 bg-gray-100 rounded" />

      {/* Desktop table skeleton */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="flex px-6 py-3 gap-10">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-3 w-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex px-6 py-4 gap-10 border-b border-gray-100"
          >
            <div className="h-4 w-28 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-5 w-14 bg-gray-100 rounded-full" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Mobile cards skeleton */}
      <div className="md:hidden space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
