import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { operationFailed, unauthorized } from "@/lib/ssot/http";

export async function GET() {
    try {
        const session = await getApiAuthSession();

        if (!session) {
            return unauthorized();
        }

        const [total, active, inactive, suspended, adminDept, academicDept] =
            await Promise.all([
                prisma.employee.count(),
                prisma.employee.count({ where: { status: "ACTIVE" } }),
                prisma.employee.count({ where: { status: "INACTIVE" } }),
                prisma.employee.count({ where: { status: "SUSPENDED" } }),
                prisma.employee.count({ where: { dept: { code: "ADMIN" } } }),
                prisma.employee.count({ where: { dept: { code: "ACADEMIC" } } }),
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
        return operationFailed(500);
    }
}
