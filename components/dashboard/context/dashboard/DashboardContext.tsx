"use client";

import { createContext, useContext } from "react";
import {
    type DashboardDataContextValue,
    type DashboardUIContextValue,
} from "./types";

export const DashboardDataContext =
    createContext<DashboardDataContextValue | null>(null);
export const DashboardUIContext = createContext<DashboardUIContextValue | null>(
    null,
);

export function useDashboardDataContext() {
    const context = useContext(DashboardDataContext);
    if (!context) {
        throw new Error(
            "useDashboardDataContext must be used within a DashboardProvider",
        );
    }
    return context;
}

export function useDashboardUIContext() {
    const context = useContext(DashboardUIContext);
    if (!context) {
        throw new Error(
            "useDashboardUIContext must be used within a DashboardProvider",
        );
    }
    return context;
}

// Legacy hook for backward compatibility or when both are needed
export function useDashboardContext() {
    const dataContext = useContext(DashboardDataContext);
    const uiContext = useContext(DashboardUIContext);

    if (!dataContext || !uiContext) {
        throw new Error(
            "useDashboardContext must be used within a DashboardProvider",
        );
    }

    return { ...dataContext, ...uiContext };
}
