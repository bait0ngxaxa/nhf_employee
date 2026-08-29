import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
    return (
        <div className="app-shell-background flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border-neutral-muted bg-surface-raised p-8 shadow-sm">
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
