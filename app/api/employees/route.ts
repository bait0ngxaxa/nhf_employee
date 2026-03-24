import { after, type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
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

// NOTE: normalized to remove mojibake
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();

        if (!session) {
            return NextResponse.json(
                { error: "Operation failed" },
                { status: 401 },
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
            { error: "Operation failed" },
            { status: 500 },
        );
    }
}

// NOTE: normalized to remove mojibake
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();

        // 1. Input Validation
        const result = createEmployeeSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                { error: "Operation failed", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        // 2. Auth Check & Access Control
        const session = await getApiAuthSession();

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Operation failed" },
                { status: 403 },
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

        const employee = createResult.employee;

        after(async () => {
            await logEmployeeEvent(
                "EMPLOYEE_CREATE",
                employee.id,
                user.id,
                user.email,
                {
                    after: {
                        firstName: employee.firstName,
                        lastName: employee.lastName,
                        email: employee.email,
                        position: employee.position,
                        departmentId: employee.departmentId,
                    },
                },
            );
        });

        return NextResponse.json(
            {
                message: "Operation completed",
                employee: createResult.employee,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Error creating employee:", error);
        return NextResponse.json(
            { error: "Operation failed" },
            { status: 500 },
        );
    }
}

