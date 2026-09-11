import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import {
    assertRoutineCapabilityForMigration,
    createRoutineCommandActor,
} from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import { applyRoutineImportBatch } from "@/modules/routine";
import {
    routineImportApplySchema,
    routineImportBatchIdSchema,
} from "@/modules/routine";

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
        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;
        const parsedBody = routineImportApplySchema.safeParse(body.body);
        if (!parsedBody.success) return NextResponse.json({ error: "กรุณายืนยันการนำเข้า" }, { status: 400 });
        const result = await applyRoutineImportBatch(Number(parsedBatchId.data), actor);
        return NextResponse.json(result);
    } catch (error) {
        return routineErrorResponse(error, "Error applying routine import batch");
    }
}
