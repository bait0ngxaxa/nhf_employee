import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";

export interface AuthenticatedUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
    department?: string;
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
    leaveCapabilities?: LeavePresentationCapabilities;
    routineCapabilities?: RoutinePresentationCapabilities;
    stockCapabilities?: StockPresentationCapabilities;
}
