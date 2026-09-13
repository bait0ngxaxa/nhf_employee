import { after, type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import {
    appendEmployeeCreateAudit,
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizedCommandActor,
    EmployeeCapabilityDeniedError,
    createEmployee,
    createEmployeeSchema,
    employeeFiltersSchema,
    listEmployees,
    type EmployeeFilters,
} from "@/modules/employee";
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

        const authorization = await assertEmployeeCapabilityForMigration(
            buildEmployeeAuthorizedCommandActor(auth.user).authorization,
            "employee.read",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const result = await listEmployees(parsedFilters.data);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        if (error instanceof EmployeeCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error fetching employees:", error);
        return operationFailed(500);
    }
}

// NOTE: normalized to remove mojibake
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const commandActor = buildEmployeeAuthorizedCommandActor(auth.user);
        const authorization = await assertEmployeeCapabilityForMigration(
            commandActor.authorization,
            "employee.create",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const body = await request.json();
        const result = createEmployeeSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return operationFailed(400, { details: errors.fieldErrors });
        }

        const createResult = await createEmployee(result.data);

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
        const auditActor = {
            userId: auth.user.id,
            email: auth.user.email,
            ipAddress: getTrustedClientIp(request.headers),
            userAgent: request.headers.get("user-agent") || null,
        };

        after(async () => {
            await appendEmployeeCreateAudit(employee, auditActor);
        });

        return NextResponse.json(
            {
                message: COMMON_API_MESSAGES.operationCompleted,
                employee: createResult.employee,
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof EmployeeCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error creating employee:", error);
        return operationFailed(500);
    }
}
