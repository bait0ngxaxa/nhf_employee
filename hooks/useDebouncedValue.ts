import { useState, useEffect } from "react";
import { LIVE_SEARCH_DEBOUNCE_MS } from "@/constants/ui";

/**
 * Custom hook that returns a debounced value
 * Useful for search inputs to avoid too many API calls
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(
    value: T,
    delay: number = LIVE_SEARCH_DEBOUNCE_MS,
): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
