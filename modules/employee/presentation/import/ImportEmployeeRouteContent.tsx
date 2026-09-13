"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ImportEmployeeCSV } from "./ImportEmployeeCSV";

export function ImportEmployeeRouteContent() {
    const { handleMenuClick } = useDashboardUIContext();
    const { user } = useDashboardDataContext();
    const { mutate } = useSWRConfig();
    const canReadStats = user?.employeeCapabilities?.canReadStats === true;
    const handleSuccess = useCallback(() => {
        if (canReadStats) {
            void mutate(API_ROUTES.employees.stats);
        }
    }, [canReadStats, mutate]);
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
