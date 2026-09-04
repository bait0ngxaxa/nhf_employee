import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/modules/routine";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { getRoutineReferenceData } from "@/modules/routine";

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
        return NextResponse.json(await getRoutineReferenceData({
            actor,
            employeeId: "employeeId" in auth ? auth.employeeId : null,
        }));
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine reference data");
    }
}
