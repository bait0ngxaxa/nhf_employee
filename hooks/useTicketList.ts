"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { type Ticket } from "@/types/tickets";
import { PAGINATION_DEFAULTS } from "@/constants/ui";

interface TicketFilters {
    status: string;
    category: string;
    priority: string;
    search: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface UseTicketListReturn {
    tickets: Ticket[];
    loading: boolean;
    error: string;
    filters: TicketFilters;
    setFilters: React.Dispatch<React.SetStateAction<TicketFilters>>;
    pagination: Pagination;
    handlePageChange: (page: number) => void;
    resetFilters: () => void;
    isNewTicket: (createdAt: string, views?: { viewedAt: string }[]) => boolean;
}

const initialFilters: TicketFilters = {
    status: "",
    category: "",
    priority: "",
    search: "",
};

const defaultPagination: Pagination = {
    page: 1,
    limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
    total: 0,
    pages: 0,
};

export function useTicketList(refreshTrigger?: number): UseTicketListReturn {
    const { data: session } = useSession();
    const [filters, setFilters] = useState<TicketFilters>(initialFilters);
    const [page, setPage] = useState(1);

    const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE.toString(),
    });

    if (filters.status) searchParams.append("status", filters.status);
    if (filters.category) searchParams.append("category", filters.category);
    if (filters.priority) searchParams.append("priority", filters.priority);

    const swrKey = session ? `/api/tickets?${searchParams.toString()}` : null;

    const { data, isLoading, error: swrError, mutate } = useSWR(swrKey);

    useEffect(() => {
        if (refreshTrigger) {
            mutate();
        }
    }, [refreshTrigger, mutate]);

    // Client-side search filtering
    const tickets = useMemo(() => {
        if (!data?.tickets) return [];
        let filtered = data.tickets;
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(
                (ticket: Ticket) =>
                    ticket.title.toLowerCase().includes(searchLower) ||
                    ticket.description.toLowerCase().includes(searchLower),
            );
        }
        return filtered;
    }, [data, filters.search]);

    const pagination = data?.pagination || defaultPagination;
    const error = swrError ? swrError.message || "เกิดข้อผิดพลาด" : "";

    // Better approach for page reset:
    const setFiltersWrapper = useCallback(
        (value: React.SetStateAction<TicketFilters>) => {
            setFilters((prev) => {
                const newVal =
                    typeof value === "function" ? value(prev) : value;
                if (
                    newVal.status !== prev.status ||
                    newVal.category !== prev.category ||
                    newVal.priority !== prev.priority
                ) {
                    setPage(1);
                }
                return newVal;
            });
        },
        [],
    );

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(initialFilters);
        setPage(1);
    }, []);

    const isNewTicket = useCallback(
        (createdAt: string, views?: { viewedAt: string }[]) => {
            const now = new Date();
            const ticketDate = new Date(createdAt);
            const hoursDiff =
                (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
            const isRecent = hoursDiff <= 24;
            const hasBeenViewed = views && views.length > 0;
            return isRecent && !hasBeenViewed;
        },
        [],
    );

    return {
        tickets,
        loading: isLoading,
        error,
        filters,
        setFilters: setFiltersWrapper,
        pagination,
        handlePageChange,
        resetFilters,
        isNewTicket,
    };
}
