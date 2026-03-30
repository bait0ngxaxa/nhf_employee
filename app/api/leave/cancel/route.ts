import { NextResponse } from "next/server";

import { logLeaveEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { APP_DASHBOARD_TABS, toDashboardTabPath } from "@/lib/ssot/routes";

export async function POST(req: Request) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.employeeProfileNotFound, 404);
        }

        const { leaveId } = await req.json();
        if (!leaveId) {
            return jsonError(COMMON_API_MESSAGES.leaveIdRequired, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId },
            });

            if (!leaveRequest || leaveRequest.employeeId !== employeeId || leaveRequest.status !== "PENDING") {
                throw new Error(COMMON_API_MESSAGES.operationFailed);
            }

            const updatedLeaveRequest = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: { status: "CANCELLED" },
            });

            await tx.notification.create({
                data: {
                    userId,
                    type: "SYSTEM_ALERT",
                    title: "ยกเลิกคำขอลาแล้ว",
                    message: `คำขอลาเลขที่ ${leaveId} ถูกยกเลิกเรียบร้อยแล้ว`,
                    actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
                    referenceId: leaveId,
                },
            });

            return updatedLeaveRequest;
        });

        await logLeaveEvent("LEAVE_REQUEST_CANCEL", leaveId, userId, session.user.email || "", {
            after: { status: "CANCELLED" },
        }).catch((err) => console.error("Failed to log leave cancel:", err));

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Cancel leave error:", error);
        return jsonError(
            error instanceof Error ? error.message : COMMON_API_MESSAGES.internalServerError,
            500,
        );
    }
}
