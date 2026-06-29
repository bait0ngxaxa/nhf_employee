import { after, type NextRequest, NextResponse } from "next/server";
import { requireAdminSession, requireApiSession } from "@/lib/auth/api";
import {
    createEmployeeSchema,
    employeeFiltersSchema,
} from "@/lib/validations/employee";
import { logEmployeeEvent } from "@/lib/server/audit";
import { employeeService, type EmployeeFilters } from "@/lib/services/employee";
import { operationFailed } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

/**
 * Parse query parameters into EmployeeFilters
 */
function parseQueryParams(
    url: string,
): { success: true; data: EmployeeFilters } | { success: false; response: NextResponse } {
    const { searchParams } = new URL(url);
    const parsed = employeeFiltersSchema.safeParse({
        search: searchParams.get("search"),
        status: searchParams.get("status"),
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "10",
    });

    if (!parsed.success) {
        return {
            success: false,
            response: operationFailed(400, {
                details: parsed.error.flatten().fieldErrors,
            }),
        };
    }

    return { success: true, data: parsed.data };
}

// NOTE: normalized to remove mojibake
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(401),
        });
        if (!auth.ok) return auth.response;

        const parsedFilters = parseQueryParams(request.url);
        if (!parsedFilters.success) {
            return parsedFilters.response;
        }

        const result = await employeeService.getEmployees(parsedFilters.data);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("Error fetching employees:", error);
        return operationFailed(500);
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
            return operationFailed(400, { details: errors.fieldErrors });
        }

        // 2. Auth Check & Access Control
        const auth = await requireAdminSession({
            unauthorizedResponse: () => operationFailed(403),
            forbiddenResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

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
                auth.user.id,
                auth.user.email,
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
                message: COMMON_API_MESSAGES.operationCompleted,
                employee: createResult.employee,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Error creating employee:", error);
        return operationFailed(500);
    }
}
