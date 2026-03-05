import { Skeleton } from "@/components/ui/skeleton";

// Generic Stats Card Skeleton
function SkeletonStatCard() {
    return (
        <div className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-6">
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
    );
}

// Table Skeleton with configurable rows
function SkeletonTable({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) {
    return (
        <div className="w-full">
            {/* Table Header */}
            <div className="flex gap-4 pb-4 border-b border-gray-100">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={`header-${i}`} className="h-4 flex-1" />
                ))}
            </div>
            {/* Table Rows */}
            <div className="space-y-4 pt-4">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton 
                                key={`cell-${rowIndex}-${colIndex}`} 
                                className="h-8 flex-1"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Form Field Skeleton
function SkeletonFormField({ fullWidth = false }: { fullWidth?: boolean }) {
    return (
        <div className={`space-y-2 ${fullWidth ? 'col-span-2' : ''}`}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
}

// Navigation Card Skeleton
function SkeletonNavCard() {
    return (
        <div className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-6">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-full" />
                </div>
            </div>
        </div>
    );
}

// Sidebar Skeleton
function SidebarSkeleton() {
    return (
        <div className="w-64 bg-white shadow-lg border-r border-gray-200/50 p-4 hidden md:flex flex-col h-full">
            {/* Logo */}
            <div className="h-8 bg-gray-200 rounded-lg animate-pulse mb-6" />
            
            {/* Menu Items */}
            <div className="space-y-3 flex-1">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-10 bg-gray-100 rounded-xl animate-pulse"
                    />
                ))}
            </div>
            
            {/* User Section */}
            <div className="h-20 bg-gray-100 rounded-xl animate-pulse mt-4" />
        </div>
    );
}

// Header Skeleton with optional actions
function HeaderSkeleton({ actionCount = 0 }: { actionCount?: number }) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            {actionCount > 0 && (
                <div className="flex gap-3">
                    {Array.from({ length: actionCount }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-24" />
                    ))}
                </div>
            )}
        </div>
    );
}

// Filter Bar Skeleton
function FilterBarSkeleton({ filterCount = 2 }: { filterCount?: number }) {
    return (
        <div className="flex flex-wrap gap-3 mb-6">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            {Array.from({ length: filterCount }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-40" />
            ))}
        </div>
    );
}

// Pagination Skeleton
function PaginationSkeleton() {
    return (
        <div className="flex justify-between items-center mt-6">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
            </div>
        </div>
    );
}

// Main Dashboard Skeleton
export default function DashboardLoading() {
    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Sidebar */}
            <SidebarSkeleton />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none contain-paint">
                    <div 
                        className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-200/20 rounded-full" 
                        style={{ filter: "blur(80px)" }}
                    />
                    <div 
                        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-200/20 rounded-full" 
                        style={{ filter: "blur(80px)" }}
                    />
                </div>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
                    <div className="space-y-6 max-w-7xl mx-auto">
                        {/* Header */}
                        <HeaderSkeleton actionCount={3} />

                        {/* Stats Cards - 4 columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <SkeletonStatCard />
                            <SkeletonStatCard />
                            <SkeletonStatCard />
                            <SkeletonStatCard />
                        </div>

                        {/* Main Content Card */}
                        <div className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-6">
                            {/* Card Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-48" />
                                </div>
                                <Skeleton className="h-10 w-32" />
                            </div>

                            {/* Filters */}
                            <FilterBarSkeleton filterCount={2} />

                            {/* Table */}
                            <SkeletonTable columns={5} rows={6} />

                            {/* Pagination */}
                            <PaginationSkeleton />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

// Export individual components for use in other places
export {
    SkeletonStatCard,
    SkeletonTable,
    SkeletonFormField,
    SkeletonNavCard,
    SidebarSkeleton,
    HeaderSkeleton,
    FilterBarSkeleton,
    PaginationSkeleton,
};