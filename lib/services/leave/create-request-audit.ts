import { logLeaveEvent } from "@/lib/server/audit";
import type { LeaveRequestValues } from "@/lib/validations/leave";

interface AuditCreatedLeaveRequestInput {
    id: string;
    userId: number;
    userEmail: string;
    payload: LeaveRequestValues;
    durationDays: number;
    emergencyReason: string | null;
    specialReason: string | null;
    attachmentCount: number;
}

export async function auditCreatedLeaveRequest(
    input: AuditCreatedLeaveRequestInput,
): Promise<void> {
    await logLeaveEvent(
        "LEAVE_REQUEST_CREATE",
        input.id,
        input.userId,
        input.userEmail,
        {
            metadata: {
                leaveType: input.payload.leaveType,
                period: input.payload.period,
                durationDays: input.durationDays,
                startDate: input.payload.startDate,
                endDate: input.payload.endDate,
                reason: input.payload.reason,
                emergencyReason: input.emergencyReason,
                specialReason: input.specialReason,
                attachmentCount: input.attachmentCount,
            },
        },
    ).catch((error: unknown) => {
        console.error("บันทึกเหตุการณ์สร้างคำขอลาไม่สำเร็จ", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
    });
}
