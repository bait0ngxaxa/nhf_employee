import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { employeeService } from "@/lib/services/employee";

// POST - Import employees from CSV
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { employees } = await request.json();

        // 1. Input Validation
        if (!employees || !Array.isArray(employees)) {
            return NextResponse.json(
                { error: "Operation failed" },
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
        return NextResponse.json(
            { error: "Operation failed" },
            { status: 500 },
        );
    }
}
