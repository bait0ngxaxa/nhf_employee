import type { LeaveRequest } from "@prisma/client";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { assertLeaveCapabilityScope, resolveLeaveCapabilityInTransaction, type LeaveAuthorizationContext } from "../authorization";
import { createLeaveAuditInTransaction, lockLeaveRequestRow } from "../../infrastructure/persistence/transaction";
import { buildLeaveAuditContext } from "../notifications/audit-details";
import { leaveSpecialReasonAmendmentSchema, type LeaveSpecialReasonAmendment } from "../../schemas/leave";

export class LeaveAmendmentError extends Error {
    constructor(message: string, public readonly statusCode: number) { super(message); }
}

export async function amendPendingLeaveSpecialReason(
    actor: { authorization: LeaveAuthorizationContext; userEmail: string },
    input: LeaveSpecialReasonAmendment,
): Promise<{ request: LeaveRequest; changed: boolean }> {
    const parsed = leaveSpecialReasonAmendmentSchema.safeParse(input);
    if (!parsed.success) throw new LeaveAmendmentError("กรุณาระบุเหตุผลพิเศษ 5–1000 ตัวอักษร", 400);
    const data = parsed.data;
    return runSerializableTransaction(async (tx) => {
        const authorization = assertLeaveCapabilityScope(await resolveLeaveCapabilityInTransaction(
            tx, actor.authorization, "leave.request.create",
        ), "OWN");
        const { employeeId, userId } = authorization.actor;
        await lockLeaveRequestRow(tx, data.leaveId);
        const request = await tx.leaveRequest.findUnique({ where: { id: data.leaveId } });
        if (!request || request.employeeId !== employeeId) throw new LeaveAmendmentError("ไม่พบคำขอลา", 404);
        if (request.status !== "PENDING") throw new LeaveAmendmentError("คำขอนี้ถูกดำเนินการแล้ว กรุณารีเฟรชรายการ", 409);
        // An identical retry is a no-op, including audit and notification side effects.
        if (request.specialReason === data.specialReason) return { request, changed: false };
        if (request.specialReason !== data.expectedSpecialReason) throw new LeaveAmendmentError("เหตุผลพิเศษมีการแก้ไขแล้ว กรุณารีเฟรชก่อนแก้ไขอีกครั้ง", 409);
        const claimed = await tx.leaveRequest.updateMany({
            where: { id: request.id, employeeId: request.employeeId, status: "PENDING", specialReason: data.expectedSpecialReason },
            data: { specialReason: data.specialReason },
        });
        if (claimed.count !== 1) throw new LeaveAmendmentError("คำขอมีการเปลี่ยนแปลง กรุณารีเฟรชรายการ", 409);
        await createLeaveAuditInTransaction(tx, "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", request.id, userId, actor.userEmail, {
            before: { status: "PENDING", specialReason: request.specialReason },
            after: { status: "PENDING", specialReason: data.specialReason },
            metadata: buildLeaveAuditContext(request),
        });
        return { request: { ...request, specialReason: data.specialReason }, changed: true };
    });
}
