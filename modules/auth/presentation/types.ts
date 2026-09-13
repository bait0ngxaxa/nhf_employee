import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
import type { DepartmentPresentationCapabilities } from "@/modules/department";
import type { AuditPresentationCapabilities } from "@/modules/audit/client";
import type { NotificationPresentationCapabilities } from "@/modules/notification/client";

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
    employeeCapabilities?: EmployeePresentationCapabilities;
    departmentCapabilities?: DepartmentPresentationCapabilities;
    auditCapabilities?: AuditPresentationCapabilities;
    notificationCapabilities?: NotificationPresentationCapabilities;
}
