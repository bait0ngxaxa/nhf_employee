import { logLeaveEvent } from "@/lib/server/audit";
interface AuditCreatedLeaveRequestInput {
    id: string;
    userId: number;
    userEmail: string;
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
                attachmentCount: input.attachmentCount,
            },
        },
    ).catch((error: unknown) => {
        console.error("บันทึกเหตุการณ์สร้างคำขอลาไม่สำเร็จ", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
    });
}
