import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineSummary } from "@/lib/services/routine";

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

        const summary = await getRoutineSummary({
            actor,
            employeeId: auth.employeeId,
            scope: "mine",
        });
        return NextResponse.json({ summary });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching LIFF routine summary");
    }
}
