import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leaveRequestSchema } from "@/lib/validations/leave";
import { DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json(
                { error: "Invalid user ID" },
                { status: 400 },
            );
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return NextResponse.json(
                { error: "ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้" },
                { status: 404 },
            );
        }

        const data = await req.json();
        const parsed = leaveRequestSchema.safeParse(data);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.format() },
                { status: 400 },
            );
        }

        const { leaveType, startDate, endDate, period, reason } = parsed.data;
        const currentYear = new Date(startDate).getFullYear();

        // Server-side enforcement: half-day period must be the same day
        if (period !== "FULL_DAY" && startDate !== endDate) {
            return NextResponse.json(
                { error: "ครึ่งวันสามารถลาได้เฉพาะวันเดียวเท่านั้น" },
                { status: 400 },
            );
        }

        // Calculate duration days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const durationDays = period === "FULL_DAY" ? diffDays : 0.5;

        // Use a transaction to check quota and create request safely
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get Employee and their Manager
            const employee = await tx.employee.findUnique({
                where: { id: employeeId },
                include: { manager: true },
            });

            if (!employee) {
                throw new Error("Employee not found");
            }

            // 2. Validate that employee has a manager to approve
            if (!employee.managerId) {
                throw new Error(
                    "ไม่พบหัวหน้างานในระบบ กรุณาติดต่อแอดมินเพื่อตั้งค่าผู้อนุมัติ",
                );
            }

            // 3. Fetch or Create Quota
            let quota = await tx.leaveQuota.findFirst({
                where: { employeeId, year: currentYear, leaveType },
            });

            if (!quota) {
                // Initialize default quota if not exists
                const defaultDays = DEFAULT_LEAVE_QUOTAS[leaveType];
                quota = await tx.leaveQuota.create({
                    data: {
                        employeeId,
                        year: currentYear,
                        leaveType,
                        totalDays: defaultDays,
                        usedDays: 0,
                    },
                });
            }

            // 4. Check Quota limit
            const availableQuota = quota.totalDays - quota.usedDays;
            if (durationDays > availableQuota) {
                throw new Error(
                    `Insufficient leave quota. You have ${availableQuota} days remaining.`,
                );
            }

            // 5. Create Request
            const leaveRequest = await tx.leaveRequest.create({
                data: {
                    employeeId,
                    leaveType,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    period,
                    durationDays,
                    reason,
                    status: "PENDING",
                    approverId: employee.managerId,
                },
            });

            // 6. Trigger Notification to Approver (always inside transaction)
            await tx.notificationOutbox.create({
                data: {
                    type: "LEAVE_ACTION",
                    payload: JSON.stringify({
                        leaveId: leaveRequest.id,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        managerId: employee.managerId,
                        leaveType,
                        startDate,
                        endDate,
                        durationDays,
                        reason,
                    }),
                },
            });

            return leaveRequest;
        });

        // Fire-and-forget: process pending outbox notifications (sends email to manager)
        processOutbox().catch((err) =>
            console.error("Outbox processing error:", err),
        );

        return NextResponse.json(
            { success: true, data: result },
            { status: 201 },
        );
    } catch (error) {
        console.error("Leave request error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to submit leave request",
            },
            { status: 500 },
        );
    }
}
