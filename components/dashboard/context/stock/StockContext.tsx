"use client";

import { createContext, useContext } from "react";
import {
    type StockDataContextValue,
    type StockUIContextValue,
} from "./types";

export const StockDataContext =
    createContext<StockDataContextValue | null>(null);
export const StockUIContext =
    createContext<StockUIContextValue | null>(null);

export function useStockDataContext(): StockDataContextValue {
    const context = useContext(StockDataContext);
    if (!context) {
        throw new Error(
            "useStockDataContext must be used within a StockProvider",
        );
    }
    return context;
}

export function useStockUIContext(): StockUIContextValue {
    const context = useContext(StockUIContext);
    if (!context) {
        throw new Error(
            "useStockUIContext must be used within a StockProvider",
        );
    }
    return context;
}
