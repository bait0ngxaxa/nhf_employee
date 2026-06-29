import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { operationFailed } from "@/lib/ssot/http";

export async function GET() {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

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
