import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "@/lib/services/leave/approver-assignment";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { forbidden, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

const bulkAssignSchema = z.object({
    assignments: z
        .array(
            z.object({
                employeeId: z.number().int().positive(),
                managerId: z.number().int().positive().nullable(),
                transferPendingRequests: z.boolean().default(false),
            }),
        )
        .min(1, "At least one assignment required")
        .superRefine((assignments, context) => {
            const seenEmployeeIds = new Set<number>();
            assignments.forEach((assignment, index) => {
                if (seenEmployeeIds.has(assignment.employeeId)) {
                    context.addIssue({
                        code: "custom",
                        message: "ห้ามกำหนดผู้อนุมัติซ้ำสำหรับพนักงานคนเดียวกัน",
                        path: [index, "employeeId"],
                    });
                }
                seenEmployeeIds.add(assignment.employeeId);
            });
        }),
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
            where: { status: "ACTIVE", deletedAt: null },
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

        const result = await assignLeaveApprovers(parsed.data.assignments, {
            userId: auth.user.id,
            email: auth.user.email,
        });

        return NextResponse.json({
            success: true,
            message: COMMON_API_MESSAGES.operationCompleted,
            transferredLeaveRequestCount: result.transferredLeaveRequestCount,
        });
    } catch (error) {
        if (error instanceof ApproverAssignmentError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode },
            );
        }
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToUpdateApprovers },
            { status: 500 },
        );
    }
}
