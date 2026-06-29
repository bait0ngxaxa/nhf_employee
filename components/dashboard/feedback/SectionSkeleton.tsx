import { Skeleton } from "@/components/ui/skeleton";

// Simple skeleton for loading dashboard sections
export function SectionSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-6"
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <div className="flex items-baseline space-x-2">
                                    <Skeleton className="h-8 w-16" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>
                            <Skeleton className="h-12 w-12 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Card */}
            <div className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <Skeleton className="h-10 flex-1 min-w-[200px]" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-40" />
                </div>

                {/* Table */}
                <div className="w-full">
                    <div className="flex gap-4 pb-4 border-b border-gray-100">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 flex-1" />
                        ))}
                    </div>
                    <div className="space-y-4 pt-4">
                        {Array.from({ length: 6 }).map((_, rowIndex) => (
                            <div key={rowIndex} className="flex gap-4 items-center">
                                {Array.from({ length: 5 }).map((_, colIndex) => (
                                    <Skeleton 
                                        key={colIndex} 
                                        className="h-8 flex-1"
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
