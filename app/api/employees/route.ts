import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEmployeeSchema } from "@/lib/validations/employee";
import { logEmployeeEvent } from "@/lib/audit";
import { employeeService, type EmployeeFilters } from "@/lib/services/employee";
import { buildUserContext } from "@/lib/context";

/**
 * Parse query parameters into EmployeeFilters
 */
function parseQueryParams(url: string): EmployeeFilters {
    const { searchParams } = new URL(url);
    return {
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
        page: parseInt(searchParams.get("page") || "1"),
        limit: parseInt(searchParams.get("limit") || "10"),
    };
}

// GET - ดึงข้อมูลพนักงาน (with pagination and filters)
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const filters = parseQueryParams(request.url);
        const result = await employeeService.getEmployees(filters);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Error fetching employees:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 },
        );
    }
}

// POST - เพิ่มพนักงานใหม่
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const body = await request.json();

        // Validate input with Zod
        const result = createEmployeeSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const createResult = await employeeService.createEmployee(result.data);

        if (!createResult.success) {
            return NextResponse.json(
                { error: createResult.error },
                { status: createResult.status || 400 },
            );
        }

        // Log audit event
        if (!createResult.employee) {
            throw new Error("Created employee data is missing");
        }

        await logEmployeeEvent(
            "EMPLOYEE_CREATE",
            createResult.employee.id,
            user.id,
            user.email,
            {
                after: {
                    firstName: createResult.employee.firstName,
                    lastName: createResult.employee.lastName,
                    email: createResult.employee.email,
                    position: createResult.employee.position,
                    departmentId: createResult.employee.departmentId,
                },
            },
        );

        return NextResponse.json(
            {
                message: "เพิ่มพนักงานสำเร็จ",
                employee: createResult.employee,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Error creating employee:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการเพิ่มพนักงาน" },
            { status: 500 },
        );
    }
}
