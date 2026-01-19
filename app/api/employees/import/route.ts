import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { employeeService } from "@/lib/services/employee";

// POST - Import employees from CSV
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const { employees } = await request.json();

        if (!employees || !Array.isArray(employees)) {
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง" },
                { status: 400 },
            );
        }

        const result = await employeeService.importEmployeesFromCSV(employees);

        return NextResponse.json(
            {
                message: `นำเข้าข้อมูลสำเร็จ ${result.success.length} คน${
                    result.errors.length > 0
                        ? `, มีข้อผิดพลาด ${result.errors.length} รายการ`
                        : ""
                }`,
                result,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error importing employees:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
            { status: 500 },
        );
    }
}
