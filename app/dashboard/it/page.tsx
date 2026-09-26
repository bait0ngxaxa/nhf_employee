import type { Metadata } from "next";
import { Suspense } from "react";

import { requireDashboardITWorkspaceAccess } from "@/app/dashboard/_lib/route-access";
import { ITWorkspace } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "บริการ IT | NHFapp",
};

export default async function ITDashboardPage(): Promise<React.ReactElement> {
    const capabilities = await requireDashboardITWorkspaceAccess();
    return (
        <Suspense fallback={<p role="status" className="py-5 text-sm text-content-secondary">กำลังโหลดบริการ IT…</p>}>
            <ITWorkspace capabilities={capabilities} />
        </Suspense>
    );
}
