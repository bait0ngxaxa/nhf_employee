import type { SWRConfiguration } from "swr";
import { fetchWithRefresh } from "@/lib/client-auth";

export const fetcher = async <T>(url: string): Promise<T> => {
    const response = await fetchWithRefresh(url, { credentials: "include" });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
            errorData.message || `HTTP Error: ${response.status}`,
        );
        (error as Error & { status: number }).status = response.status;
        throw error;
    }

    return response.json();
};

export const swrConfig: SWRConfiguration = {
    fetcher,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: true,
    errorRetryCount: 3,
    dedupingInterval: 2000,
};
