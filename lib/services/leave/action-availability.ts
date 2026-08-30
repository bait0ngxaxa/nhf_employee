import { isAfterLeaveEnd, isBeforeLeaveStart } from "@/lib/services/leave/utils";
import type {
    ApproverLeaveAction,
    EmployeeLeaveAction,
    LeaveStatusValue,
} from "@/lib/types/leave";

interface EmployeeActionRequest {
    status: LeaveStatusValue;
    startDate: Date | string;
    endDate: Date | string;
    cancellationRequestedAt: Date | string | null;
    notTakenRequestedAt: Date | string | null;
}

interface ApproverActionRequest {
    status: LeaveStatusValue;
    startDate: Date | string;
    notTakenRequestedAt: Date | string | null;
    notTakenConfirmedAt: Date | string | null;
}

export function getEmployeeLeaveActions(
    request: EmployeeActionRequest,
): EmployeeLeaveAction[] {
    if (request.status === "PENDING") {
        return ["CANCEL"];
    }

    if (request.status !== "APPROVED") {
        return [];
    }

    const actions: EmployeeLeaveAction[] = [];
    if (
        request.cancellationRequestedAt === null
        && isBeforeLeaveStart(request.startDate)
    ) {
        actions.push("REQUEST_CANCELLATION");
    }
    if (
        request.notTakenRequestedAt === null
        && isAfterLeaveEnd(request.endDate)
    ) {
        actions.push("REQUEST_NOT_TAKEN");
    }
    return actions;
}

export function getApproverLeaveActions(
    request: ApproverActionRequest,
): ApproverLeaveAction[] {
    if (request.status === "PENDING") {
        return ["APPROVE", "REJECT"];
    }
    if (
        request.status === "APPROVED"
        && request.notTakenRequestedAt !== null
        && request.notTakenConfirmedAt === null
    ) {
        return ["CONFIRM_NOT_TAKEN"];
    }
    if (request.status === "CANCELLATION_REQUESTED") {
        return isBeforeLeaveStart(request.startDate)
            ? ["CONFIRM_CANCELLATION", "REJECT_CANCELLATION"]
            : ["REJECT_CANCELLATION"];
    }
    return [];
}
