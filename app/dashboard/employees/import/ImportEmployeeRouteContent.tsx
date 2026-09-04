"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { ImportEmployeeCSV } from "@/components/employee/import-csv/ImportEmployeeCSV";
import { API_ROUTES } from "@/lib/ssot/routes";

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
