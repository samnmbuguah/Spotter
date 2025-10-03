import React from 'react';
import Skeleton from './Skeleton';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Welcome Header Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton width="w-64" height="h-8" />
            <Skeleton width="w-48" height="h-4" />
          </div>
          <Skeleton width="w-24" height="h-10" />
        </div>
      </div>

      {/* HOS Status Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton width="w-24" height="h-4" />
                <Skeleton width="w-16" height="h-8" />
                <Skeleton width="w-20" height="h-3" />
              </div>
              <Skeleton width="w-8" height="h-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <Skeleton width="w-32" height="h-6" className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} height="h-12" />
          ))}
        </div>
      </div>

      {/* Recent Trips Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton width="w-24" height="h-6" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <Skeleton width="w-3" height="h-3" />
                <div className="space-y-1">
                  <Skeleton width="w-32" height="h-4" />
                  <Skeleton width="w-24" height="h-3" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton width="w-16" height="h-5" />
                <Skeleton width="w-20" height="h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
