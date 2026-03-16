import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationOutboxType } from "@prisma/client";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";

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

            return updatedRequest;
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Intranet Leave Approval Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to process leave approval" },
            { status: 500 }
        );
    }
}
