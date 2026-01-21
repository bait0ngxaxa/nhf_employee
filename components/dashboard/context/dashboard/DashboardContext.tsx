"use client";

import { createContext, useContext } from "react";
import { type DashboardContextValue } from "./types";

export const DashboardContext = createContext<DashboardContextValue | null>(
    null,
);

export function useDashboardContext(): DashboardContextValue {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error(
            "useDashboardContext must be used within a DashboardProvider",
        );
    }
    return context;
}
