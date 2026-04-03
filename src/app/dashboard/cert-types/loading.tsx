export default function CertTypesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-32 bg-gray-200 rounded" />

      {/* Add form skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-10 w-full bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="h-10 w-24 bg-blue-100 rounded-lg" />
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-100 rounded" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-12 bg-blue-100 rounded" />
                <div className="h-4 w-12 bg-red-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
