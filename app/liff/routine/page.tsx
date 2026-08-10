import type { Metadata } from "next";
import type { ReactElement } from "react";
import { Suspense } from "react";

import { LiffRoutineApp } from "@/components/liff/routine/LiffRoutineApp";

export const metadata: Metadata = {
    title: "งาน Routine ของฉัน | NHFapp",
};

export default function Page(): ReactElement {
    return (
        <Suspense
            fallback={
                <div
                    className="flex min-h-svh items-center justify-center bg-surface-subtle px-4 text-sm font-medium text-content-secondary"
                    role="status"
                >
                    กำลังเตรียมหน้า My Routine...
                </div>
            }
        >
            <LiffRoutineApp />
        </Suspense>
    );
}
