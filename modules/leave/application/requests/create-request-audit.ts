import {
    defineLeaveAuditDetails,
    type LeaveAuditDetailsFor,
} from "@/modules/leave/domain/audit";
import { buildLeaveAuditContext } from "@/modules/leave/application/notifications/audit-details";

interface CreatedLeaveRequestAuditInput {
    request: {
        id: string;
        employeeId: number;
        leaveType: "SICK" | "PERSONAL" | "VACATION";
        startDate: Date;
        endDate: Date;
        period: "FULL_DAY" | "MORNING" | "AFTERNOON";
        durationHalfDays: number;
    };
    employeeName: string;
    attachmentCount: number;
}

export function buildCreatedLeaveRequestAuditDetails(
    input: CreatedLeaveRequestAuditInput,
): LeaveAuditDetailsFor<"LEAVE_REQUEST_CREATE"> {
    return defineLeaveAuditDetails("LEAVE_REQUEST_CREATE", {
        after: { status: "PENDING" },
        metadata: buildLeaveAuditContext(input.request, {
            employeeName: input.employeeName,
            attachmentCount: input.attachmentCount,
        }),
    });
}
