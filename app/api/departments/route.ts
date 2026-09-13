import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { operationFailed } from "@/lib/ssot/http";
import {
    assertDepartmentCapabilityForMigration,
    assertDepartmentCapabilityScope,
    buildDepartmentAuthorizationContext,
    DepartmentCapabilityDeniedError,
    listDepartments,
} from "@/modules/department";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const authorization = await assertDepartmentCapabilityForMigration(
            buildDepartmentAuthorizationContext(auth.user),
            "department.read",
        );
        assertDepartmentCapabilityScope(authorization, "ALL");

        const departments = await listDepartments();

        return NextResponse.json({ departments }, { status: 200 });
    } catch (error) {
        if (error instanceof DepartmentCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error fetching departments:", error);
        return operationFailed(500);
    }
}
