import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { type TicketStats, type Ticket } from "@/types/tickets";

export function useITIssues() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState("tickets");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [ticketStats, setTicketStats] = useState<TicketStats>({
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
    });
    const [statsLoading, setStatsLoading] = useState(true);

    const isAdmin = session?.user?.role === "ADMIN";

    const fetchTicketStats = useCallback(async () => {
        if (!session) return;

        try {
            setStatsLoading(true);
            const response = await fetch("/api/tickets?limit=1000"); // Get all tickets for stats

            if (response.ok) {
                const data = await response.json();
                const tickets = data.tickets || [];

                // Check if ticket is new (created within last 24 hours) AND not viewed by current user
                const isNewTicket = (
                    createdAt: string,
                    views: { viewedAt: string }[]
                ) => {
                    const now = new Date();
                    const ticketDate = new Date(createdAt);
                    const hoursDiff =
                        (now.getTime() - ticketDate.getTime()) /
                        (1000 * 60 * 60);
                    const isRecent = hoursDiff <= 24;
                    const hasBeenViewed = views.length > 0;
                    return isRecent && !hasBeenViewed;
                };

                // Calculate statistics
                const stats = {
                    total: tickets.length,
                    open: tickets.filter((t: Ticket) => t.status === "OPEN")
                        .length,
                    inProgress: tickets.filter(
                        (t: Ticket) => t.status === "IN_PROGRESS"
                    ).length,
                    resolved: tickets.filter(
                        (t: Ticket) => t.status === "RESOLVED"
                    ).length,
                    closed: tickets.filter((t: Ticket) => t.status === "CLOSED")
                        .length,
                    cancelled: tickets.filter(
                        (t: Ticket) => t.status === "CANCELLED"
                    ).length,
                    highPriority: tickets.filter(
                        (t: Ticket) => t.priority === "HIGH"
                    ).length,
                    urgentPriority: tickets.filter(
                        (t: Ticket) => t.priority === "URGENT"
                    ).length,
                    newTickets: tickets.filter((t: Ticket) =>
                        isNewTicket(t.createdAt, t.views ?? [])
                    ).length,
                    userTickets: isAdmin
                        ? tickets.filter(
                              (t: Ticket) =>
                                  t.assignedTo?.id === parseInt(session.user.id)
                          ).length
                        : tickets.filter(
                              (t: Ticket) =>
                                  t.reportedBy.id === parseInt(session.user.id)
                          ).length,
                };

                setTicketStats(stats);
            }
        } catch (error) {
            console.error("Error fetching ticket stats:", error);
        } finally {
            setStatsLoading(false);
        }
    }, [session, isAdmin]);

    useEffect(() => {
        fetchTicketStats();
    }, [fetchTicketStats, refreshTrigger]);

    const handleTicketCreated = () => {
        setRefreshTrigger((prev) => prev + 1);
        setShowCreateModal(false);
        setActiveTab("tickets");
    };

    const handleTicketSelect = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setActiveTab("detail");
    };

    const handleTicketUpdated = () => {
        setRefreshTrigger((prev) => prev + 1);
        setSelectedTicket(null);
        setActiveTab("tickets");
    };

    const handleBackToList = () => {
        setSelectedTicket(null);
        setActiveTab("tickets");
    };

    return {
        session,
        activeTab,
        setActiveTab,
        selectedTicket,
        refreshTrigger,
        showCreateModal,
        setShowCreateModal,
        ticketStats,
        statsLoading,
        isAdmin,
        handleTicketCreated,
        handleTicketSelect,
        handleTicketUpdated,
        handleBackToList,
    };
}
