import { NextResponse, after } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { leaveRequestSchema } from "@/lib/validations/leave";
import { DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";
import { logLeaveEvent } from "@/lib/audit";
import { getWorkingDays } from "@/lib/services/leave/utils";

export async function POST(req: Request) {
    try {
        const session = await getApiAuthSession();
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
                { error: "Operation failed" },
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
                { error: "Operation failed" },
                { status: 400 },
            );
        }

        // Calculate duration days excluding weekends
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        let diffDays = getWorkingDays(start, end);

        // If it's a half day, duration is 0.5, but we must ensure it is a working day
        if (period !== "FULL_DAY") {
            if (diffDays === 0) {
                 return NextResponse.json(
                    { error: "Operation failed" },
                    { status: 400 },
                );
            }
            diffDays = 0.5;
        } else {
             if (diffDays === 0) {
                return NextResponse.json(
                    { error: "Operation failed" },
                    { status: 400 },
                );
            }
        }

        const durationDays = diffDays;

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
                throw new Error("No manager is configured for this employee");
            }

            // 3. Check for overlapping requests
            const overlappingRequests = await tx.leaveRequest.findFirst({
                where: {
                    employeeId,
                    status: { in: ["PENDING", "APPROVED"] },
                    AND: [
                        { startDate: { lte: new Date(endDate) } },
                        { endDate: { gte: new Date(startDate) } },
                    ],
                },
            });

            if (overlappingRequests) {
                throw new Error("Operation failed");
            }

            // 4. Fetch or Create Quota
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

            // 5. Check Quota limit and atomically reserve quota
            const availableQuota = quota.totalDays - quota.usedDays;
            if (durationDays > availableQuota) {
                throw new Error(
                    `Operation status`,
                );
            }

            // 6. Create Request
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

            // 7. Trigger Notification to Approver (always inside transaction)
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

        // Non-blocking operation: process pending outbox notifications (sends email to manager)
        after(() => {
            processOutbox().catch((err) =>
                console.error("Failed to process outbox in background:", err),
            );
        });

        // Audit Logging
        await logLeaveEvent(
            "LEAVE_REQUEST_CREATE",
            result.id,
            userId,
            session.user.email || "",
            {
                metadata: {
                    leaveType: parsed.data.leaveType,
                    period: parsed.data.period,
                    durationDays,
                    startDate: parsed.data.startDate,
                    endDate: parsed.data.endDate,
                    reason: parsed.data.reason
                }
            }
        ).catch((err) => console.error("Failed to log audit event:", err));

        return NextResponse.json({ success: true, data: result }, { status: 201 });
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
