"use client";

import { createContext, useContext } from "react";
import { type EmailRequestContextValue } from "./types";

export const EmailRequestContext =
    createContext<EmailRequestContextValue | null>(null);

export function useEmailRequestContext(): EmailRequestContextValue {
    const context = useContext(EmailRequestContext);
    if (!context) {
        throw new Error(
            "useEmailRequestContext must be used within an EmailRequestProvider",
        );
    }
    return context;
}
