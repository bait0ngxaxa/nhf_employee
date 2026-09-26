"use client";

import type { ReactElement } from "react";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { EmailRequestSection as ITEmailRequestSection } from "@/modules/it/client";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";

export function EmailRequestSection({
    capabilities,
}: {
    capabilities: EmailRequestPresentationCapabilities;
}): ReactElement {
    const { handleMenuClick } = useDashboardUIContext();
    const returnToDashboard = (): void => handleMenuClick("dashboard");

    return (
        <ITEmailRequestSection
            capabilities={capabilities}
            onCancel={returnToDashboard}
            onSuccess={returnToDashboard}
        />
    );
}
