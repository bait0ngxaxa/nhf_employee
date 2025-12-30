import { ComponentType } from "react";

export interface MenuItem {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    description: string;
    requiredRole?: "ADMIN";
}

export interface DashboardStats {
    total: number;
    active: number;
    admin: number;
    academic: number;
}

export interface TicketStats {
    total: number;
    open: number;
    inProgress: number;
    assignedToMe: number;
}
