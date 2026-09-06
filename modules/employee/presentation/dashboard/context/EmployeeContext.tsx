"use client";

import { createContext, useContext } from "react";
import {
    type EmployeeDataContextValue,
    type EmployeeUIContextValue,
} from "./types";

export const EmployeeDataContext =
    createContext<EmployeeDataContextValue | null>(null);
export const EmployeeUIContext = createContext<EmployeeUIContextValue | null>(
    null,
);

export function useEmployeeDataContext() {
    const context = useContext(EmployeeDataContext);
    if (!context) {
        throw new Error(
            "useEmployeeDataContext must be used within an EmployeeProvider",
        );
    }
    return context;
}

export function useEmployeeUIContext() {
    const context = useContext(EmployeeUIContext);
    if (!context) {
        throw new Error(
            "useEmployeeUIContext must be used within an EmployeeProvider",
        );
    }
    return context;
}

// Legacy hook for backward compatibility or when both are needed
export function useEmployeeContext() {
    const dataContext = useContext(EmployeeDataContext);
    const uiContext = useContext(EmployeeUIContext);

    if (!dataContext || !uiContext) {
        throw new Error(
            "useEmployeeContext must be used within an EmployeeProvider",
        );
    }

    return { ...dataContext, ...uiContext };
}
