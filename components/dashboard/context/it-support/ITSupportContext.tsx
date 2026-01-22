"use client";

import { createContext, useContext } from "react";
import {
    type ITSupportDataContextValue,
    type ITSupportUIContextValue,
} from "./types";

export const ITSupportDataContext =
    createContext<ITSupportDataContextValue | null>(null);
export const ITSupportUIContext = createContext<ITSupportUIContextValue | null>(
    null,
);

export function useITSupportDataContext() {
    const context = useContext(ITSupportDataContext);
    if (!context) {
        throw new Error(
            "useITSupportDataContext must be used within an ITSupportProvider",
        );
    }
    return context;
}

export function useITSupportUIContext() {
    const context = useContext(ITSupportUIContext);
    if (!context) {
        throw new Error(
            "useITSupportUIContext must be used within an ITSupportProvider",
        );
    }
    return context;
}

// Legacy hook for backward compatibility or when both are needed
export function useITSupportContext() {
    const dataContext = useContext(ITSupportDataContext);
    const uiContext = useContext(ITSupportUIContext);

    if (!dataContext || !uiContext) {
        throw new Error(
            "useITSupportContext must be used within an ITSupportProvider",
        );
    }

    return { ...dataContext, ...uiContext };
}
