"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { type TicketStats, type Ticket } from "@/types/tickets";
import { ITSupportDataContext, ITSupportUIContext } from "./ITSupportContext";
import { isAdminRole } from "@/lib/ssot/permissions";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import {
    type ITSupportDataContextValue,
    type ITSupportUIContextValue,
} from "./types";

interface ITSupportProviderProps {
    children: ReactNode;
}

const checkIsNewTicket = (
    createdAt: string,
    views: { viewedAt: string }[] = [],
) => {
    const now = new Date();
    const ticketDate = new Date(createdAt);
    const hoursDiff = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
    const isRecent = hoursDiff <= 24;
    const hasBeenViewed = views.length > 0;
    return isRecent && !hasBeenViewed;
};

const defaultStats: TicketStats = {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    cancelled: 0,
    highPriority: 0,
    urgentPriority: 0,
    userTickets: 0,
    newTickets: 0,
};

export function ITSupportProvider({ children }: ITSupportProviderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const [activeTab, setActiveTab] = useState("tickets");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const shouldIgnoreUrlTicketSyncRef = useRef(false);

    const isAdmin = isAdminRole(session?.user?.role);

    const { data, mutate, isLoading } = useSWR<{ tickets: Ticket[] }>(
        session ? `${API_ROUTES.tickets.list}?limit=100` : null,
    );

    const syncTicketIdToUrl = useCallback(
        (ticketId: number | null) => {
            if (pathname !== APP_ROUTES.dashboard) {
                return;
            }

            const nextParams = new URLSearchParams(searchParamsString);
            if (ticketId === null) {
                nextParams.delete("ticketId");
            } else {
                nextParams.set("ticketId", String(ticketId));
            }

            const current = searchParamsString;
            const next = nextParams.toString();
            if (current === next) {
                return;
            }

            const nextUrl = next ? `${pathname}?${next}` : pathname;
            router.replace(nextUrl, { scroll: false });
        },
        [pathname, router, searchParamsString],
    );

    useEffect(() => {
        const currentSearchParams = new URLSearchParams(searchParamsString);
        if (currentSearchParams.get("tab") !== "it-support") {
            return;
        }

        const ticketIdParam = currentSearchParams.get("ticketId");
        if (!ticketIdParam) {
            shouldIgnoreUrlTicketSyncRef.current = false;
            return;
        }

        if (shouldIgnoreUrlTicketSyncRef.current) {
            return;
        }

        const ticketId = Number(ticketIdParam);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return;
        }

        const ticketFromList = data?.tickets?.find((ticket) => ticket.id === ticketId);
        if (!ticketFromList) {
            return;
        }

        if (selectedTicket?.id !== ticketId) {
            setSelectedTicket(ticketFromList);
        }
        if (activeTab !== "detail") {
            setActiveTab("detail");
        }
    }, [activeTab, data?.tickets, searchParamsString, selectedTicket?.id]);

    const ticketStats = useMemo<TicketStats>(() => {
        if (!data?.tickets) return defaultStats;

        const tickets = data.tickets;

        return {
            total: tickets.length,
            open: tickets.filter((t) => t.status === "OPEN").length,
            inProgress: tickets.filter((t) => t.status === "IN_PROGRESS")
                .length,
            resolved: tickets.filter((t) => t.status === "RESOLVED").length,
            closed: tickets.filter((t) => t.status === "CLOSED").length,
            cancelled: tickets.filter((t) => t.status === "CANCELLED").length,
            highPriority: tickets.filter((t) => t.priority === "HIGH").length,
            urgentPriority: tickets.filter((t) => t.priority === "URGENT")
                .length,
            newTickets: tickets.filter((t) =>
                checkIsNewTicket(t.createdAt, t.views),
            ).length,
            userTickets: isAdmin
                ? tickets.filter(
                      (t) =>
                          t.assignedTo?.id ===
                          parseInt(session?.user?.id || "0"),
                  ).length
                : tickets.filter(
                      (t) =>
                          t.reportedBy.id ===
                          parseInt(session?.user?.id || "0"),
                  ).length,
        };
    }, [data, isAdmin, session]);

    const handleTicketCreated = useCallback(() => {
        mutate();
        setRefreshTrigger((prev) => prev + 1);
        setShowCreateModal(false);
        setActiveTab("tickets");
        setSelectedTicket(null);
        syncTicketIdToUrl(null);
    }, [mutate, syncTicketIdToUrl]);

    const handleTicketSelect = useCallback((ticket: Ticket) => {
        shouldIgnoreUrlTicketSyncRef.current = false;
        setSelectedTicket(ticket);
        setActiveTab("detail");
        syncTicketIdToUrl(ticket.id);
    }, [syncTicketIdToUrl]);

    const handleTicketUpdated = useCallback(() => {
        shouldIgnoreUrlTicketSyncRef.current = true;
        mutate();
        setRefreshTrigger((prev) => prev + 1);
        setSelectedTicket(null);
        setActiveTab("tickets");
        syncTicketIdToUrl(null);
    }, [mutate, syncTicketIdToUrl]);

    const handleBackToList = useCallback(() => {
        shouldIgnoreUrlTicketSyncRef.current = true;
        setSelectedTicket(null);
        setActiveTab("tickets");
        syncTicketIdToUrl(null);
    }, [syncTicketIdToUrl]);

    const dataValue = useMemo<ITSupportDataContextValue>(
        () => ({
            session,
            isAdmin,
            ticketStats,
            statsLoading: isLoading,
            refreshTrigger,
            handleTicketCreated,
            handleTicketUpdated,
        }),
        [
            session,
            isAdmin,
            ticketStats,
            isLoading,
            refreshTrigger,
            handleTicketCreated,
            handleTicketUpdated,
        ],
    );

    const uiValue = useMemo<ITSupportUIContextValue>(
        () => ({
            activeTab,
            setActiveTab,
            selectedTicket,
            showCreateModal,
            setShowCreateModal,
            handleTicketSelect,
            handleBackToList,
        }),
        [
            activeTab,
            setActiveTab,
            selectedTicket,
            showCreateModal,
            setShowCreateModal,
            handleTicketSelect,
            handleBackToList,
        ],
    );

    return (
        <ITSupportDataContext.Provider value={dataValue}>
            <ITSupportUIContext.Provider value={uiValue}>
                {children}
            </ITSupportUIContext.Provider>
        </ITSupportDataContext.Provider>
    );
}
