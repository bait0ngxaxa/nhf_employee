import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationOutboxType } from "@prisma/client";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { logLeaveEvent } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return NextResponse.json({ error: "ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้" }, { status: 404 });
        }

        const { leaveId, action, reason } = await req.json();

        if (!leaveId || !action || !["APPROVE", "REJECT"].includes(action)) {
            return NextResponse.json({ error: "Invalid action parameters" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch Request & verify authorization
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId },
                include: { employee: true }
            });

            if (!leaveRequest) throw new Error("Leave request not found");
            if (leaveRequest.status !== "PENDING") throw new Error("This request is already processed");
            
            // Managers can only approve their own subordinates' requests, OR HR/Admin can be allowed here in the future
            if (leaveRequest.approverId !== managerId) {
                throw new Error("You are not authorized to approve this request");
            }

            const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

            // 2. Update LeaveRequest Status
            const updatedRequest = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: newStatus,
                    approvedAt: new Date(),
                    rejectReason: action === "REJECT" ? reason : null
                }
            });

            // 3. Update LeaveQuota if actually Approved
            if (action === "APPROVE") {
                const quota = await tx.leaveQuota.findFirst({
                    where: {
                        employeeId: leaveRequest.employeeId,
                        leaveType: leaveRequest.leaveType,
                        year: new Date(leaveRequest.startDate).getFullYear()
                    }
                });

                if (!quota) throw new Error("Leave quota not found");

                // Re-validate quota to prevent race condition
                const remaining = quota.totalDays - quota.usedDays;
                if (leaveRequest.durationDays > remaining) {
                    throw new Error(`โควต้าวันลาไม่เพียงพอ (คงเหลือ ${remaining} วัน)`);
                }

                await tx.leaveQuota.update({
                    where: { id: quota.id },
                    data: { usedDays: quota.usedDays + leaveRequest.durationDays }
                });
            }

            // 4. Send Notification back to Employee
            await tx.notificationOutbox.create({
                data: {
                    type: NotificationOutboxType.LEAVE_RESULT,
                    payload: JSON.stringify({
                        leaveId,
                        employeeId: leaveRequest.employeeId,
                        employeeEmail: leaveRequest.employee.email,
                        status: newStatus,
                        reason: action === "REJECT" ? reason : null
                    })
                }
            });

            // 5. Create In-App Notification for the Employee
            const employeeUser = await tx.user.findUnique({
                where: { employeeId: leaveRequest.employeeId },
                select: { id: true }
            });

            if (employeeUser) {
                const actionTextTh = action === "APPROVE" ? "อนุมัติ" : "ไม่อนุมัติ";
                await tx.notification.create({
                    data: {
                        userId: employeeUser.id,
                        type: action === "APPROVE" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
                        title: `ผลการพิจารณาคำร้องขอลา`,
                        message: `คำร้องขอลาของคุณได้รับการพิจารณาแล้ว: **${actionTextTh}**${
                            action === "REJECT" && reason ? ` (เหตุผล: ${reason})` : ""
                        }`,
                        actionUrl: "/dashboard?tab=leave-management",
                        referenceId: leaveId,
                    }
                });
            }

            return updatedRequest;
        });

        // Audit Logging outside transaction
        const auditAction =
            action === "APPROVE"
                ? "LEAVE_REQUEST_APPROVE"
                : "LEAVE_REQUEST_REJECT";

        // Fetch user email for audit log if possible, otherwise use a fallback
        const userEmail = session.user.email || `User ${userId}`;

        // Get employee name if possible (result.employee is not returned from transaction
        // because we updated the request. Let's just log the action with what we have)
        await logLeaveEvent(
            auditAction,
            leaveId,
            userId, // Manager who performed action
            userEmail,
            {
                after: {
                    status: action === "APPROVE" ? "APPROVED" : "REJECTED",
                    reason: action === "REJECT" ? reason : null,
                },
            }
        ).catch((err) => console.error("Failed to log audit event:", err));

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Intranet Leave Approval Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to process leave approval" },
            { status: 500 }
        );
    }
}
