import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export default function ITAnalyticsLoading(): ReactElement {
    return (
        <section
            aria-label="กำลังโหลดรายงาน IT"
            aria-busy="true"
            className="w-full space-y-5 p-4 sm:p-6"
        >
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-11 w-full max-w-sm" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 7 }, (_, index) => (
                    <Skeleton key={index} className="h-28 w-full rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </section>
    );
}
