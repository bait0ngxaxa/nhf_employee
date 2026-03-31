"use client";

import {
    useState,
    useCallback,
    useMemo,
    useEffect,
    type ReactNode,
} from "react";
import useSWR from "swr";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AuditLogsContext } from "./AuditLogsContext";
import { type AuditLog, type AuditLogsContextValue } from "./types";

interface AuditLogsProviderProps {
    children: ReactNode;
}

export function AuditLogsProvider({ children }: AuditLogsProviderProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", "15");

    if (actionFilter !== "all") {
        params.set("action", actionFilter);
    }
    if (entityTypeFilter !== "all") {
        params.set("entityType", entityTypeFilter);
    }
    if (debouncedSearchTerm.trim().length > 0) {
        params.set("search", debouncedSearchTerm.trim());
    }

    const swrKey = `/api/audit-logs?${params.toString()}`;

    const { data, mutate, isLoading, error: swrError } = useSWR(swrKey);

    const auditLogs: AuditLog[] = useMemo(
        () => data?.auditLogs || [],
        [data?.auditLogs],
    );
    const totalPages = data?.pagination?.pages || 1;
    const error = swrError ? swrError.message || "เกิดข้อผิดพลาด" : "";

    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, entityTypeFilter]);

    const filteredLogs = useMemo(() => auditLogs, [auditLogs]);

    const handleSearchTermChange = useCallback((term: string) => {
        setSearchTerm(term);
        setCurrentPage(1);
    }, []);

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((p) => Math.max(p - 1, 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((p) => Math.min(p + 1, totalPages));
    }, [totalPages]);

    const refresh = useCallback(() => {
        mutate();
    }, [mutate]);

    const value = useMemo<AuditLogsContextValue>(
        () => ({
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
            setSearchTerm: handleSearchTermChange,
            refresh,
            handlePreviousPage,
            handleNextPage,
        }),
        [
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
            handleSearchTermChange,
            refresh,
            handlePreviousPage,
            handleNextPage,
        ],
    );

    return (
        <AuditLogsContext.Provider value={value}>
            {children}
        </AuditLogsContext.Provider>
    );
}
