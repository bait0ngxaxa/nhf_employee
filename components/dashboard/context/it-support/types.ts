import { type Ticket, type TicketStats } from "@/types/tickets";
import { type Session } from "next-auth";

export interface ITSupportContextValue {
    // Session
    session: Session | null;
    isAdmin: boolean;

    // Tabs & Navigation
    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedTicket: Ticket | null;

    // State
    refreshTrigger: number;
    showCreateModal: boolean;
    setShowCreateModal: (show: boolean) => void;
    ticketStats: TicketStats;
    statsLoading: boolean;

    // Actions
    handleTicketCreated: () => void;
    handleTicketSelect: (ticket: Ticket) => void;
    handleTicketUpdated: () => void;
    handleBackToList: () => void;
}
