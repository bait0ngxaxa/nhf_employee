import { NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

// NOTE: normalized to remove mojibake
export async function GET() {
    try {
        const session = await getApiAuthSession();

        if (!session) {
            return NextResponse.json(
                { error: "Operation failed" },
                { status: 401 },
            );
        }

        // Get all counts in parallel using Prisma aggregations
        const [total, active, inactive, suspended, adminDept, academicDept] =
            await Promise.all([
                prisma.employee.count(),
                prisma.employee.count({ where: { status: "ACTIVE" } }),
                prisma.employee.count({ where: { status: "INACTIVE" } }),
                prisma.employee.count({ where: { status: "SUSPENDED" } }),
                prisma.employee.count({
                    where: {
                        dept: { code: "ADMIN" },
                    },
                }),
                prisma.employee.count({
                    where: {
                        dept: { code: "ACADEMIC" },
                    },
                }),
            ]);

        return NextResponse.json({
            success: true,
            stats: {
                total,
                active,
                inactive,
                suspended,
                admin: adminDept,
                academic: academicDept,
            },
        });
    } catch (error) {
        console.error("Error fetching employee stats:", error);
        return NextResponse.json(
            { error: "Operation failed" },
            { status: 500 },
        );
    }
}

