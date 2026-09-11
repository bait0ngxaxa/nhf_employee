import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import {
    assertRoutineCapabilityForMigration,
    createRoutineCommandActor,
} from "@/modules/routine";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { getRoutineImportReferenceData } from "@/modules/routine";

export async function GET(_request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            _request.headers,
        );
        await assertRoutineCapabilityForMigration(
            actor,
            "employeeId" in auth ? auth.employeeId : null,
            "routine.import.manage",
        );
        return NextResponse.json(await getRoutineImportReferenceData(actor));
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine import reference data");
    }
}
