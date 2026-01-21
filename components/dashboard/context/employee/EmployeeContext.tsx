"use client";

import { createContext, useContext } from "react";
import { type EmployeeContextValue } from "./types";

export const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function useEmployeeContext(): EmployeeContextValue {
    const context = useContext(EmployeeContext);
    if (!context) {
        throw new Error(
            "useEmployeeContext must be used within an EmployeeProvider",
        );
    }
    return context;
}
