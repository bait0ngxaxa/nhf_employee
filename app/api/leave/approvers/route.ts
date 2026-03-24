import { NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bulkAssignSchema = z.object({
    assignments: z.array(
        z.object({
            employeeId: z.number().int().positive(),
            managerId: z.number().int().positive().nullable(),
        })
    ).min(1, "At least one assignment required"),
});

/**
 * GET โ€” Fetch all active employees for admin approver management
 */
export async function GET() {
    try {
        const session = await getApiAuthSession();
        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

// NOTE: normalized to remove mojibake
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
            { error: "Failed to fetch approver data" },
            { status: 500 }
        );
    }
}

/**
 * PUT โ€” Bulk-assign managerId for multiple employees
 */
export async function PUT(req: Request) {
    try {
        const session = await getApiAuthSession();
        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = bulkAssignSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { assignments } = parsed.data;

        // Validate no self-assignment
        const selfAssign = assignments.find(a => a.employeeId === a.managerId);
        if (selfAssign) {
            return NextResponse.json(
                { error: "Operation failed" },
                { status: 400 }
            );
        }

        // Use transaction for atomicity
        await prisma.$transaction(
            assignments.map(({ employeeId, managerId }) =>
                prisma.employee.update({
                    where: { id: employeeId },
                    data: { managerId },
                })
            )
        );

        return NextResponse.json({
            success: true,
            message: "Operation completed",
        });
    } catch (error) {
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: "Failed to update approvers" },
            { status: 500 }
        );
    }
}

