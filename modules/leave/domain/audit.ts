import type { AuditAction } from "@prisma/client";

import type { AuditDetails } from "@/modules/audit";

export interface LeaveAuditContext extends Record<string, unknown> {
    leaveRequestId: string;
    employeeId?: number;
    employeeName?: string;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: string;
    endDate: string;
    period: "FULL_DAY" | "MORNING" | "AFTERNOON";
    durationDays: number;
    attachmentCount?: number;
    reason?: string | null;
}

export interface LeaveCreateAuditDetails extends AuditDetails {
    after: Record<string, unknown> & { status: string };
    metadata: LeaveAuditContext;
}

export interface LeaveMutationAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & {
        status: string;
        reason?: string | null;
    };
    metadata: LeaveAuditContext & {
        decision?: string;
        adminOverride?: boolean;
        overrideReason?: string;
        originalApproverId?: number | null;
        exceptionApproverId?: number | null;
        exceptionApproverSource?: string;
    };
}

/**
 * Special-reason amendments are personal explanations visible only through
 * Leave ownership/approver boundaries. The generic audit trail records that a
 * change happened, never the explanation text itself.
 */
export type LeaveSpecialReasonChangeType = "ADDED" | "UPDATED";

export interface LeaveSpecialReasonAuditDetails extends AuditDetails {
    before: { status: "PENDING"; hasSpecialReason: boolean; specialReason?: never };
    after: { status: "PENDING"; hasSpecialReason: true; specialReason?: never };
    metadata: LeaveAuditContext & {
        changedField: "specialReason";
        changeType: LeaveSpecialReasonChangeType;
    };
}

export interface EmployeeApproverAuditDetails extends AuditDetails {
    before: {
        managerId: number | null;
        managerName: string | null;
    };
    after: {
        managerId: number | null;
        managerName: string | null;
    };
    metadata: {
        employeeId: number;
        employeeName: string;
        previousApproverId: number | null;
        previousApproverName: string | null;
        newApproverId: number | null;
        newApproverName: string | null;
    };
}

interface LeaveAuditDetailsByAction {
    LEAVE_REQUEST_CREATE: LeaveCreateAuditDetails;
    LEAVE_REQUEST_SPECIAL_REASON_UPDATE: LeaveSpecialReasonAuditDetails;
    LEAVE_REQUEST_APPROVE: LeaveMutationAuditDetails;
    LEAVE_REQUEST_REJECT: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCEL: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCELLATION_REQUEST: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCELLATION_CONFIRM: LeaveMutationAuditDetails;
    LEAVE_REQUEST_NOT_TAKEN_REQUEST: LeaveMutationAuditDetails;
    LEAVE_REQUEST_NOT_TAKEN_CONFIRM: LeaveMutationAuditDetails;
    EMPLOYEE_UPDATE: EmployeeApproverAuditDetails;
}

export type LeaveContractedAuditAction = keyof LeaveAuditDetailsByAction & AuditAction;

export type LeaveAuditDetailsFor<Action extends LeaveContractedAuditAction> =
    LeaveAuditDetailsByAction[Action];

export function defineLeaveAuditDetails<Action extends LeaveContractedAuditAction>(
    _action: Action,
    details: LeaveAuditDetailsFor<Action>,
): LeaveAuditDetailsFor<Action> {
    return details;
}
