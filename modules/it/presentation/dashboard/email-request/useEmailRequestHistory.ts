import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api-client";
import type { EmailRequest, Pagination } from "../../../domain/email-request/contracts";

type SettledRequest =
    | {
          key: string;
          status: "ready";
          emailRequests: EmailRequest[];
          pagination: Pagination;
      }
    | {
          key: string;
          status: "error";
          error: string;
          pagination: Pagination;
      };

interface UseEmailRequestHistoryReturn {
    emailRequests: EmailRequest[];
    pagination: Pagination;
    isLoading: boolean;
    error: string | null;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    refresh: () => void;
}

const INITIAL_PAGINATION: Pagination = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
};

export function useEmailRequestHistory(): UseEmailRequestHistoryReturn {
    const [currentPage, setCurrentPageState] = useState(1);
    const [refreshGeneration, setRefreshGeneration] = useState(0);
    const [settledRequest, setSettledRequest] = useState<SettledRequest | null>(null);
    const requestKey = `page=${currentPage}&refresh=${refreshGeneration}`;
    const currentResult = settledRequest?.key === requestKey ? settledRequest : null;
    const pagination = settledRequest?.pagination ?? INITIAL_PAGINATION;

    useEffect(() => {
        let cancelled = false;
        const key = `page=${currentPage}&refresh=${refreshGeneration}`;
        const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: "10",
        });

        const load = async (): Promise<void> => {
            try {
                const result = await apiGet<{
                    success: boolean;
                    emailRequests: EmailRequest[];
                    pagination: Pagination;
                }>(`/api/email-request?${params}`);

                if (cancelled) return;

                if (result.success) {
                    setSettledRequest({
                        key,
                        status: "ready",
                        emailRequests: result.data.emailRequests,
                        pagination: result.data.pagination,
                    });
                } else {
                    setSettledRequest((previous) => ({
                        key,
                        status: "error",
                        error: result.error,
                        pagination: previous?.pagination ?? INITIAL_PAGINATION,
                    }));
                }
            } catch (err) {
                if (cancelled) return;

                console.error("Error fetching email requests:", err);
                setSettledRequest((previous) => ({
                    key,
                    status: "error",
                    error: "เกิดข้อผิดพลาดในการเชื่อมต่อ",
                    pagination: previous?.pagination ?? INITIAL_PAGINATION,
                }));
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [currentPage, refreshGeneration]);

    const updateCurrentPage = useCallback((page: number): void => {
        const maxPage = Math.max(1, pagination.totalPages || 1);
        setCurrentPageState(Math.min(Math.max(1, page), maxPage));
    }, [pagination.totalPages]);

    const refresh = useCallback((): void => {
        setRefreshGeneration((previous) => previous + 1);
    }, []);

    return {
        emailRequests: currentResult?.status === "ready" ? currentResult.emailRequests : [],
        pagination,
        isLoading: currentResult === null,
        error: currentResult?.status === "error" ? currentResult.error : null,
        currentPage,
        setCurrentPage: updateCurrentPage,
        refresh,
    };
}
