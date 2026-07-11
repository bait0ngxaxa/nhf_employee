import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { forbidden, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

const bulkAssignSchema = z.object({
    assignments: z
        .array(
            z.object({
                employeeId: z.number().int().positive(),
                managerId: z.number().int().positive().nullable(),
                transferPendingRequests: z.boolean().optional().default(false),
            }),
        )
        .min(1, "At least one assignment required"),
});

export async function GET(): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireAdminSession({
            unauthorizedResponse: () => forbidden(),
        });
        if (!auth.ok) return auth.response;

        const employees = await prisma.employee.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                email: true,
                position: true,
                managerId: true,
                dept: { select: { name: true } },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });

        return NextResponse.json({ employees });
    } catch (error) {
        console.error("Error fetching approver data:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApproverData },
            { status: 500 },
        );
    }
}

export async function PUT(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireAdminSession({
            unauthorizedResponse: () => forbidden(),
        });
        if (!auth.ok) return auth.response;

        const body = await req.json();
        const parsed = bulkAssignSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidInput, details: parsed.error.format() },
                { status: 400 },
            );
        }

        const { assignments } = parsed.data;

        const selfAssign = assignments.find((a) => a.employeeId === a.managerId);
        if (selfAssign) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.operationFailed },
                { status: 400 },
            );
        }

        const transferredLeaveRequestCount = await prisma.$transaction(async (tx) => {
            let count = 0;
            for (const { employeeId, managerId, transferPendingRequests } of assignments) {
                await tx.employee.update({ where: { id: employeeId }, data: { managerId } });
                if (transferPendingRequests && managerId) {
                    const result = await tx.leaveRequest.updateMany({
                        where: { employeeId, status: "PENDING", approverId: { not: managerId } },
                        data: { approverId: managerId },
                    });
                    count += result.count;
                }
            }
            return count;
        });

        return NextResponse.json({
            success: true,
            message: COMMON_API_MESSAGES.operationCompleted,
            transferredLeaveRequestCount,
        });
    } catch (error) {
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToUpdateApprovers },
            { status: 500 },
        );
    }
}
