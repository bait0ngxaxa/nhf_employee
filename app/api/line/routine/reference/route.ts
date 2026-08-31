import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { serializeLiffRoutineReference } from "@/lib/server/line-routine-api";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineReferenceData } from "@/lib/services/routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role,
                email: auth.user.email,
            },
            request.headers,
        );
        const reference = await getRoutineReferenceData({
            actor,
            employeeId: auth.employeeId,
        });
        return NextResponse.json(serializeLiffRoutineReference(reference));
    } catch (error) {
        return routineErrorResponse(
            error,
            "Error fetching LIFF routine reference data",
        );
    }
}
