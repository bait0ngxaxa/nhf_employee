import { NextResponse } from "next/server";
import { verifyLeaveToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing token" },
                { status: 400 }
            );
        }

        // 1. Verify Token
        const payload = await verifyLeaveToken(token);
        if (!payload) {
            return NextResponse.json(
                { success: false, error: "ลิงก์อนุมัติไม่ถูกต้อง หรือหมดอายุแล้ว" },
                { status: 401 }
            );
        }

        const { leaveId, approverId, action } = payload;

        // 2. Fetch Leave Request with employee data for notification
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: leaveId },
            include: { employee: { select: { email: true } } }
        });

        if (!leaveRequest) {
            return NextResponse.json(
                { success: false, error: "ไม่พบข้อมูลใบลาในระบบ" },
                { status: 404 }
            );
        }

        if (leaveRequest.status !== "PENDING") {
            return NextResponse.json(
                { success: false, error: `คำขอนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: ${leaveRequest.status})` },
                { status: 400 }
            );
        }

        // 3. Process the action (approve or reject)
        const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

        // 4. Update Database + create notification inside a single transaction
        await prisma.$transaction(async (tx) => {
            // Update request status
            await tx.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: newStatus,
                    approverId: approverId,
                    approvedAt: new Date(),
                }
            });

            // If approved, re-validate and update the employee's used quota
            if (newStatus === "APPROVED") {
                const currentYear = new Date(leaveRequest.startDate).getFullYear();
                
                const quota = await tx.leaveQuota.findUnique({
                    where: {
                        employeeId_year_leaveType: {
                            employeeId: leaveRequest.employeeId,
                            year: currentYear,
                            leaveType: leaveRequest.leaveType
                        }
                    }
                });

                if (!quota) {
                    throw new Error("ไม่พบโควต้าวันลาของพนักงาน");
                }

                // Re-validate quota to prevent race condition
                const remaining = quota.totalDays - quota.usedDays;
                if (leaveRequest.durationDays > remaining) {
                    throw new Error(`โควต้าวันลาไม่เพียงพอ (คงเหลือ ${remaining} วัน)`);
                }

                await tx.leaveQuota.update({
                    where: { id: quota.id },
                    data: {
                        usedDays: quota.usedDays + leaveRequest.durationDays
                    }
                });
            }

            // 5. Create notification inside the transaction for atomicity
            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_RESULT",
                    payload: JSON.stringify({
                        leaveId: leaveId,
                        status: newStatus,
                        employeeId: leaveRequest.employeeId,
                        employeeEmail: leaveRequest.employee.email,
                        reason: null
                    })
                }
            });
        });

        return NextResponse.json({
            success: true,
            message: `ทำรายการ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}ใบลาเรียบร้อยแล้ว`
        });

    } catch (error) {
        console.error("❌ [Leave Action API] Error processing token:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง" },
            { status: 500 }
        );
    }
}

