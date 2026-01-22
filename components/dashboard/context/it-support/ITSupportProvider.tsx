"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { type TicketStats, type Ticket } from "@/types/tickets";
import { ITSupportDataContext, ITSupportUIContext } from "./ITSupportContext";
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
    const [activeTab, setActiveTab] = useState("tickets");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const isAdmin = session?.user?.role === "ADMIN";

    const { data, mutate, isLoading } = useSWR<{ tickets: Ticket[] }>(
        session ? "/api/tickets?limit=1000" : null,
    );

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
    }, [mutate]);

    const handleTicketSelect = useCallback((ticket: Ticket) => {
        setSelectedTicket(ticket);
        setActiveTab("detail");
    }, []);

    const handleTicketUpdated = useCallback(() => {
        mutate();
        setRefreshTrigger((prev) => prev + 1);
        setSelectedTicket(null);
        setActiveTab("tickets");
    }, [mutate]);

    const handleBackToList = useCallback(() => {
        setSelectedTicket(null);
        setActiveTab("tickets");
    }, []);

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
