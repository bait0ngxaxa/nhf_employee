import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
import type { DepartmentPresentationCapabilities } from "@/modules/department";
import type { AuditPresentationCapabilities } from "@/modules/audit/client";
import type { NotificationPresentationCapabilities } from "@/modules/notification/client";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";
import type { ITPresentationCapabilities } from "@/modules/it/client";
import type { UserTeamPresentation } from "@/shared/identity/team-presentation";

export interface AuthenticatedUser {
    id: string;
    employeeId?: number;
    role: string;
    email?: string | null;
    name?: string | null;
    department?: string;
    teams?: readonly UserTeamPresentation[];
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
    leaveCapabilities?: LeavePresentationCapabilities;
    routineCapabilities?: RoutinePresentationCapabilities;
    stockCapabilities?: StockPresentationCapabilities;
    employeeCapabilities?: EmployeePresentationCapabilities;
    departmentCapabilities?: DepartmentPresentationCapabilities;
    auditCapabilities?: AuditPresentationCapabilities;
    notificationCapabilities?: NotificationPresentationCapabilities;
    emailRequestCapabilities?: EmailRequestPresentationCapabilities;
    itCapabilities?: ITPresentationCapabilities;
}
