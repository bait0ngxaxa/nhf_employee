import {
    defineAuditDetails,
    type AuditDetailsFor,
} from "@/lib/audit-log/contracts";
import { buildLeaveAuditContext } from "./audit-details";

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
): AuditDetailsFor<"LEAVE_REQUEST_CREATE"> {
    return defineAuditDetails("LEAVE_REQUEST_CREATE", {
        after: { status: "PENDING" },
        metadata: buildLeaveAuditContext(input.request, {
            employeeName: input.employeeName,
            attachmentCount: input.attachmentCount,
        }),
    });
}
