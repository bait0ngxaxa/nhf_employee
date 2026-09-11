import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import {
    assertRoutineCapabilityForMigration,
    createRoutineCommandActor,
} from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import { cancelRoutineImportBatch } from "@/modules/routine";
import { routineImportBatchIdSchema } from "@/modules/routine";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        await assertRoutineCapabilityForMigration(
            actor,
            "employeeId" in auth ? auth.employeeId : null,
            "routine.import.manage",
        );
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-import",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;
        const { batchId: rawBatchId } = await params;
        const parsedBatchId = routineImportBatchIdSchema.safeParse(rawBatchId);
        if (!parsedBatchId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const batch = await cancelRoutineImportBatch(Number(parsedBatchId.data), actor);
        return NextResponse.json({ batch });
    } catch (error) {
        return routineErrorResponse(error, "Error cancelling routine import batch");
    }
}
