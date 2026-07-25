"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
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
import { useAuth } from "@/components/auth/HybridAuthProvider";

interface ITSupportProviderProps {
    children: ReactNode;
}

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
    const { user } = useAuth();
    const session = useMemo(() => (user ? { user } : null), [user]);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const [activeTab, setActiveTab] = useState("tickets");
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const shouldIgnoreUrlTicketSyncRef = useRef(false);

    const isAdmin = isAdminRole(session?.user?.role);

    const {
        data: statsData,
        mutate: mutateStats,
        isLoading: statsLoading,
    } = useSWR<{ stats: TicketStats }>(
        session ? API_ROUTES.tickets.stats : null,
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

        if (selectedTicketId !== ticketId) {
            setSelectedTicketId(ticketId);
        }
        if (activeTab !== "detail") {
            setActiveTab("detail");
        }
    }, [activeTab, searchParamsString, selectedTicketId]);

    const ticketStats = statsData?.stats ?? defaultStats;

    const handleTicketCreated = useCallback(() => {
        void mutateStats();
        setRefreshTrigger((prev) => prev + 1);
        setShowCreateModal(false);
        setActiveTab("tickets");
        setSelectedTicketId(null);
        syncTicketIdToUrl(null);
    }, [mutateStats, syncTicketIdToUrl]);

    const handleTicketSelect = useCallback((ticket: Ticket) => {
        shouldIgnoreUrlTicketSyncRef.current = false;
        setSelectedTicketId(ticket.id);
        setActiveTab("detail");
        syncTicketIdToUrl(ticket.id);
    }, [syncTicketIdToUrl]);

    const handleTicketUpdated = useCallback(() => {
        shouldIgnoreUrlTicketSyncRef.current = true;
        void mutateStats();
        setRefreshTrigger((prev) => prev + 1);
        setSelectedTicketId(null);
        setActiveTab("tickets");
        syncTicketIdToUrl(null);
    }, [mutateStats, syncTicketIdToUrl]);

    const handleBackToList = useCallback(() => {
        shouldIgnoreUrlTicketSyncRef.current = true;
        setSelectedTicketId(null);
        setActiveTab("tickets");
        syncTicketIdToUrl(null);
    }, [syncTicketIdToUrl]);

    const dataValue = useMemo<ITSupportDataContextValue>(
        () => ({
            session,
            isAdmin,
            ticketStats,
            statsLoading,
            refreshTrigger,
            handleTicketCreated,
            handleTicketUpdated,
        }),
        [
            session,
            isAdmin,
            ticketStats,
            statsLoading,
            refreshTrigger,
            handleTicketCreated,
            handleTicketUpdated,
        ],
    );

    const uiValue = useMemo<ITSupportUIContextValue>(
        () => ({
            activeTab,
            setActiveTab,
            selectedTicketId,
            showCreateModal,
            setShowCreateModal,
            handleTicketSelect,
            handleBackToList,
        }),
        [
            activeTab,
            setActiveTab,
            selectedTicketId,
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
