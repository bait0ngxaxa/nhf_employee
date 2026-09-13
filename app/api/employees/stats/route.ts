import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import {
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext,
    EmployeeCapabilityDeniedError,
    getEmployeeStats,
} from "@/modules/employee";
import { operationFailed } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const authorization = await assertEmployeeCapabilityForMigration(
            buildEmployeeAuthorizationContext(auth.user),
            "employee.stats.read",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const stats = await getEmployeeStats();

        return NextResponse.json({
            success: true,
            stats,
        });
    } catch (error) {
        if (error instanceof EmployeeCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error fetching employee stats:", error);
        return operationFailed(500);
    }
}
