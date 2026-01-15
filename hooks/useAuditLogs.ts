import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    userId: number | null;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
    user: {
        id: number;
        name: string;
        email: string;
    } | null;
}

interface UseAuditLogsReturn {
    auditLogs: AuditLog[];
    filteredLogs: AuditLog[];
    isLoading: boolean;
    error: string;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    totalPages: number;
    actionFilter: string;
    setActionFilter: (filter: string) => void;
    entityTypeFilter: string;
    setEntityTypeFilter: (filter: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    refresh: () => void;
    handlePreviousPage: () => void;
    handleNextPage: () => void;
}

export function useAuditLogs(): UseAuditLogsReturn {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Debounce search for client-side filtering
    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

    const fetchAuditLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            const params = new URLSearchParams();
            params.set("page", currentPage.toString());
            params.set("limit", "15");

            if (actionFilter !== "all") {
                params.set("action", actionFilter);
            }
            if (entityTypeFilter !== "all") {
                params.set("entityType", entityTypeFilter);
            }

            const response = await fetch(
                `/api/audit-logs?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data.auditLogs);
                setTotalPages(data.pagination.pages);
            } else {
                const errorData = await response.json();
                setError(errorData.error || "เกิดข้อผิดพลาด");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            console.error("Error fetching audit logs:", err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, actionFilter, entityTypeFilter]);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, entityTypeFilter]);

    // Client-side filtering for search
    const filteredLogs = auditLogs.filter((log) => {
        if (!debouncedSearchTerm) return true;
        const searchLower = debouncedSearchTerm.toLowerCase();
        return (
            log.userEmail?.toLowerCase().includes(searchLower) ||
            log.user?.name.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower) ||
            log.entityType.toLowerCase().includes(searchLower)
        );
    });

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((p) => Math.max(p - 1, 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((p) => Math.min(p + 1, totalPages));
    }, [totalPages]);

    return {
        auditLogs,
        filteredLogs,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
        totalPages,
        actionFilter,
        setActionFilter,
        entityTypeFilter,
        setEntityTypeFilter,
        searchTerm,
        setSearchTerm,
        refresh: fetchAuditLogs,
        handlePreviousPage,
        handleNextPage,
    };
}
