import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { employeeService } from "@/lib/services/employee";
import { operationFailed } from "@/lib/ssot/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { employees } = await request.json();

        if (!employees || !Array.isArray(employees)) {
            return operationFailed(400);
        }

        const auth = await requireAdminSession({
            unauthorizedResponse: () => operationFailed(403),
            forbiddenResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const result = await employeeService.importEmployeesFromCSV(employees);

        return NextResponse.json(
            {
                message: `Imported ${result.success.length} records successfully${
                    result.errors.length > 0
                        ? `, with ${result.errors.length} failed records`
                        : ""
                }`,
                result,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error importing employees:", error);
        return operationFailed(500);
    }
}
