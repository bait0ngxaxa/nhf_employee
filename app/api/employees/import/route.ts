import { type NextRequest, NextResponse } from "next/server";

import { getApiAuthSession } from "@/lib/server-auth";
import { employeeService } from "@/lib/services/employee";
import { operationFailed } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { employees } = await request.json();

        if (!employees || !Array.isArray(employees)) {
            return operationFailed(400);
        }

        const session = await getApiAuthSession();
        if (!session || !isAdminRole(session.user?.role)) {
            return operationFailed(403);
        }

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
