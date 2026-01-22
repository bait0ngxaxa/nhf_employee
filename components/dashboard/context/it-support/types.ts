import { type Ticket, type TicketStats } from "@/types/tickets";
import { type Session } from "next-auth";

export interface ITSupportDataContextValue {
    // Session Data
    session: Session | null;
    isAdmin: boolean;

    // Ticket Data
    ticketStats: TicketStats;
    statsLoading: boolean;
    refreshTrigger: number;

    // Data Actions
    handleTicketCreated: () => void;
    handleTicketUpdated: () => void;
}

export interface ITSupportUIContextValue {
    // Tabs & Navigation State
    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedTicket: Ticket | null;

    // Modal State
    showCreateModal: boolean;
    setShowCreateModal: (show: boolean) => void;

    // UI Actions
    handleTicketSelect: (ticket: Ticket) => void;
    handleBackToList: () => void;
}

export interface ITSupportContextValue
    extends ITSupportDataContextValue, ITSupportUIContextValue {}
