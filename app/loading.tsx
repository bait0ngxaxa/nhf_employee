import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl" />
            </div>

            {/* Skeleton Content */}
            <div className="relative z-10 w-full max-w-md mx-4 space-y-6">
                <div className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-8">
                    <div className="flex flex-col items-center space-y-4">
                        <Skeleton className="h-12 w-12 rounded-xl" />
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                </div>
            </div>
        </div>
    );
}
