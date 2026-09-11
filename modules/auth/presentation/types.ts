import type { RoutinePresentationCapabilities } from "@/modules/routine/client";

export interface AuthenticatedUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
    department?: string;
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
    routineCapabilities?: RoutinePresentationCapabilities;
}
