"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ImportEmployeeCSV } from "./ImportEmployeeCSV";

export function ImportEmployeeRouteContent() {
    const { handleMenuClick } = useDashboardUIContext();
    const { mutate } = useSWRConfig();
    const handleSuccess = useCallback(() => {
        void mutate(API_ROUTES.employees.stats);
    }, [mutate]);
    const handleBack = useCallback(() => {
        handleMenuClick("employee-management");
    }, [handleMenuClick]);

    return (
        <ImportEmployeeCSV
            onSuccess={handleSuccess}
            onBack={handleBack}
        />
    );
}
