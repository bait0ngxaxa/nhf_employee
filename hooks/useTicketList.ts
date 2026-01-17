import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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

export function useTicketList(refreshTrigger?: number): UseTicketListReturn {
    const { data: session } = useSession();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState<TicketFilters>(initialFilters);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
        total: 0,
        pages: 0,
    });

    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const searchParams = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });

            if (filters.status) searchParams.append("status", filters.status);
            if (filters.category)
                searchParams.append("category", filters.category);
            if (filters.priority)
                searchParams.append("priority", filters.priority);

            const response = await fetch(`/api/tickets?${searchParams}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "เกิดข้อผิดพลาด");
            }

            // Filter by search text on client side
            let filteredTickets = data.tickets;
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                filteredTickets = data.tickets.filter(
                    (ticket: Ticket) =>
                        ticket.title.toLowerCase().includes(searchLower) ||
                        ticket.description.toLowerCase().includes(searchLower)
                );
            }

            setTickets(filteredTickets);
            setPagination(data.pagination);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการโหลดข้อมูล";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [
        filters.status,
        filters.category,
        filters.priority,
        filters.search,
        pagination.page,
        pagination.limit,
    ]);

    useEffect(() => {
        if (session) {
            fetchTickets();
        }
    }, [session, refreshTrigger, fetchTickets]);

    useEffect(() => {
        // Reset to first page when filters change
        if (pagination.page !== 1) {
            setPagination((prev) => ({ ...prev, page: 1 }));
        } else {
            fetchTickets();
        }
    }, [filters.search, fetchTickets, pagination.page]);

    const handlePageChange = useCallback((newPage: number) => {
        setPagination((prev) => ({ ...prev, page: newPage }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(initialFilters);
    }, []);

    // Check if ticket is new (created within last 24 hours) AND not viewed
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
        []
    );

    return {
        tickets,
        loading,
        error,
        filters,
        setFilters,
        pagination,
        handlePageChange,
        resetFilters,
        isNewTicket,
    };
}
