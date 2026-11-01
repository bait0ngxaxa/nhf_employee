import { NextResponse, type NextRequest } from "next/server";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { jsonError } from "@/lib/ssot/http";
import { LeaveCapabilityDeniedError, type LeaveAuthorizationContext } from "../application/authorization";
import { amendPendingLeaveSpecialReason, LeaveAmendmentError } from "../application/requests/amend-special-reason";
import { leaveSpecialReasonAmendmentSchema } from "../schemas/leave";
import { readLeaveJsonBody } from "./http";

export async function handleLeaveSpecialReasonAmendment(
    request: NextRequest,
    actor: { authorization: LeaveAuthorizationContext; userEmail: string },
): Promise<NextResponse> {
    try {
        const body = await readLeaveJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = leaveSpecialReasonAmendmentSchema.safeParse(body.body);
        if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง กรุณาระบุเหตุผลพิเศษ 5–1000 ตัวอักษร", 400);
        const result = await amendPendingLeaveSpecialReason(actor, parsed.data);
        return NextResponse.json({ success: true, data: { id: result.request.id, status: result.request.status, specialReason: result.request.specialReason } });
    } catch (error) {
        if (error instanceof LeaveAmendmentError) return jsonError(error.message, error.statusCode);
        if (error instanceof LeaveCapabilityDeniedError || error instanceof WorkforceAuthorizationError) return jsonError("คุณไม่มีสิทธิ์ดำเนินการ", 403);
        console.error("Leave special reason amendment failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        return jsonError("บันทึกเหตุผลพิเศษไม่สำเร็จ กรุณาลองใหม่", 500);
    }
}
