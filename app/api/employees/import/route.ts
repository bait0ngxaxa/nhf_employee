import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import {
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizedCommandActor,
    EMPLOYEE_IMPORT_MAX_ROWS,
    EmployeeCapabilityDeniedError,
    importEmployeesFromCsvRows,
} from "@/modules/employee";
import { jsonError, operationFailed } from "@/lib/ssot/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const commandActor = buildEmployeeAuthorizedCommandActor(auth.user);
        const authorization = await assertEmployeeCapabilityForMigration(
            commandActor.authorization,
            "employee.import",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const { employees } = await request.json();

        if (!employees || !Array.isArray(employees)) {
            return operationFailed(400);
        }
        if (employees.length > EMPLOYEE_IMPORT_MAX_ROWS) {
            return jsonError(
                `นำเข้าข้อมูลพนักงานได้ไม่เกิน ${EMPLOYEE_IMPORT_MAX_ROWS} รายการต่อครั้ง`,
                400,
            );
        }

        const result = await importEmployeesFromCsvRows(employees);

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
        if (error instanceof EmployeeCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error importing employees:", error);
        return operationFailed(500);
    }
}
