export default function SessionLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="h-6 w-6 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-1" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-6 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-6 w-6 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Center column */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
          {/* Tab bar skeleton */}
          <div className="flex border-b border-gray-100 flex-shrink-0 px-4 py-2.5 gap-4">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
          {/* Content skeleton */}
          <div className="flex-1 px-4 py-6 space-y-4">
            <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>

        {/* Right panel skeleton */}
        <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 bg-orange-50 flex-shrink-0">
            <div className="h-4 w-16 bg-orange-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 px-3 py-3 space-y-3">
            <div className="h-4 w-5/6 bg-orange-100 rounded animate-pulse" />
            <div className="h-8 w-full bg-orange-50 rounded-lg animate-pulse" />
            <div className="h-8 w-full bg-orange-50 rounded-lg animate-pulse" />
            <div className="h-8 w-full bg-orange-50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
