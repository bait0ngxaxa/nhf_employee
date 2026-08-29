import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="app-shell-background flex min-h-screen items-center justify-center">
            <div className="w-full max-w-md px-4">
                <div className="rounded-2xl border border-border-neutral-muted bg-surface-raised p-8 shadow-sm">
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
