"use client";

import { SWRConfig } from "swr";
import { type ReactNode } from "react";
import { swrConfig } from "@/lib/client/swr";

interface SWRProviderProps {
    children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
    return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
