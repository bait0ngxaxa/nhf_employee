import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";

interface EmailRequest {
    id: number;
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    createdAt: string;
    updatedAt: string;
    requestedBy: number;
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface UseEmailRequestHistoryReturn {
    emailRequests: EmailRequest[];
    pagination: Pagination;
    isLoading: boolean;
    error: string | null;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    refresh: () => void;
}

export function useEmailRequestHistory(): UseEmailRequestHistoryReturn {
    const [emailRequests, setEmailRequests] = useState<EmailRequest[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchEmailRequests = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "10",
            });

            const result = await apiGet<{
                success: boolean;
                emailRequests: EmailRequest[];
                pagination: Pagination;
            }>(`/api/email-request?${params}`);

            if (result.success) {
                setEmailRequests(result.data.emailRequests);
                setPagination(result.data.pagination);
            } else {
                setError(result.error);
            }
        } catch (err) {
            console.error("Error fetching email requests:", err);
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    }, [currentPage]);

    useEffect(() => {
        fetchEmailRequests();
    }, [fetchEmailRequests, refreshTrigger]);

    const refresh = useCallback(() => {
        setRefreshTrigger((prev) => prev + 1);
    }, []);

    return {
        emailRequests,
        pagination,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
        refresh,
    };
}
