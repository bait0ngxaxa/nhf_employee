import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { getRoutineImportReferenceData } from "@/modules/routine";

export async function GET(_request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        return NextResponse.json(await getRoutineImportReferenceData());
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine import reference data");
    }
}
