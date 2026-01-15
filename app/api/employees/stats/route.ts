import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - ดึงสถิติพนักงานทั้งหมด (ไม่มี pagination)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 }
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
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 }
        );
    }
}
