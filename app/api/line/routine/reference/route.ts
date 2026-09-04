import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { serializeLiffRoutineReference } from "@/modules/routine";
import { createRoutineCommandActor } from "@/modules/routine";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { getRoutineReferenceData } from "@/modules/routine";

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
