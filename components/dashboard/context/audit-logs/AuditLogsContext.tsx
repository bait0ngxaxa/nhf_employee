"use client";

import { createContext, useContext } from "react";
import { type AuditLogsContextValue } from "./types";

export const AuditLogsContext = createContext<AuditLogsContextValue | null>(
    null,
);

export function useAuditLogsContext(): AuditLogsContextValue {
    const context = useContext(AuditLogsContext);
    if (!context) {
        throw new Error(
            "useAuditLogsContext must be used within an AuditLogsProvider",
        );
    }
    return context;
}
