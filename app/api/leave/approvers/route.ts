import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { forbidden } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";

const bulkAssignSchema = z.object({
    assignments: z
        .array(
            z.object({
                employeeId: z.number().int().positive(),
                managerId: z.number().int().positive().nullable(),
            }),
        )
        .min(1, "At least one assignment required"),
});

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session || !isAdminRole(session.user?.role)) {
            return forbidden();
        }

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
        const session = await getApiAuthSession();
        if (!session || !isAdminRole(session.user?.role)) {
            return forbidden();
        }

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

        await prisma.$transaction(
            assignments.map(({ employeeId, managerId }) =>
                prisma.employee.update({
                    where: { id: employeeId },
                    data: { managerId },
                }),
            ),
        );

        return NextResponse.json({
            success: true,
            message: COMMON_API_MESSAGES.operationCompleted,
        });
    } catch (error) {
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToUpdateApprovers },
            { status: 500 },
        );
    }
}
