export default function SessionLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="h-6 w-6 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-48 rounded mb-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          <div className="h-3 w-24 rounded bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite_0.2s]" />
        </div>
        <div className="h-6 w-6 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        <div className="h-6 w-6 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Center column */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
          {/* Tab bar skeleton */}
          <div className="flex border-b border-gray-100 flex-shrink-0 px-4 py-2.5 gap-4">
            <div className="h-4 w-16 rounded bg-gradient-to-r from-primary-100 via-primary-50 to-primary-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            <div className="h-4 w-24 rounded bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
          {/* Content skeleton */}
          <div className="flex-1 px-4 py-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-200 to-primary-100 animate-pulse" />
              <div className="h-4 w-40 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="rounded bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                  style={{ height: i === 0 ? 20 : 16, width: ['75%', '100%', '83%', '66%', '80%', '50%'][i], animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel skeleton */}
        <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 bg-orange-50 flex-shrink-0 flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-orange-200 animate-pulse" />
            <div className="h-4 w-12 rounded bg-gradient-to-r from-orange-200 via-orange-100 to-orange-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
          <div className="flex-1 px-3 py-4 flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 animate-pulse" />
            <div className="h-3 w-32 rounded bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            <div className="w-full space-y-1.5 mt-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-8 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
