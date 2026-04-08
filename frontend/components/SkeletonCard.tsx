export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        <div className="h-6 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-32"></div>
      </div>
    </div>
  );
}
