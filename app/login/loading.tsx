import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
            </div>

            {/* Login Form Skeleton */}
            <div className="relative z-10 bg-white/60 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-8 max-w-md w-full mx-4">
                <div className="flex flex-col items-center space-y-6">
                    {/* Logo / Icon */}
                    <Skeleton className="h-14 w-14 rounded-xl" />
                    {/* Title */}
                    <Skeleton className="h-6 w-48" />

                    {/* Form Fields */}
                    <div className="w-full space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        </div>
    );
}
