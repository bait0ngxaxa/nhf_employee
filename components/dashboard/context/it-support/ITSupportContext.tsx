"use client";

import { createContext, useContext } from "react";
import { type ITSupportContextValue } from "./types";

export const ITSupportContext = createContext<ITSupportContextValue | null>(
    null,
);

export function useITSupportContext(): ITSupportContextValue {
    const context = useContext(ITSupportContext);
    if (!context) {
        throw new Error(
            "useITSupportContext must be used within an ITSupportProvider",
        );
    }
    return context;
}
